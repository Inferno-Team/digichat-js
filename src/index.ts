import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import FormData from "form-data";
import { createHttp, DigiChatError } from "./http";
import type {
    ChannelInfoResponse,
    DeferredCancelResponse,
    DeferredMessageResponse,
    DeferredQueueResponse,
    DigiChatClientOptions,
    InviteInfoResponse,
    MediaInput,
    MediaPayload,
    MessageContentType,
    MessageTargetType,
    QrResponse,
    SendOptions,
    SendResponse,
    StatusResponse
} from "./types";

const DEFAULT_BASE = "https://digichat.digiworld-dev.com";

/** Raw digits (contact), or a full chat id ending with @c.us, @g.us or @newsletter. */
const CHAT_ID_PATTERN = /^\d+(?:@(?:c\.us|g\.us|newsletter))?$/;

export class DigiChat {
    private token: string;
    private secret: string;
    private baseUrl: string;
    private http;

    constructor(opts: DigiChatClientOptions) {
        this.token = opts.token;
        this.secret = opts.secret;
        this.baseUrl = DEFAULT_BASE;
        this.http = createHttp(this.baseUrl, opts.timeoutMs ?? 15_000);
    }

    /** GET /api/whatsapp/{token}/ping */
    async ping(): Promise<string | Record<string, unknown>> {
        const { data } = await this.http.get(this.url("ping"));
        return data;
    }

    /** POST /api/whatsapp/{token}/start — start or resume the session */
    async startSession(): Promise<{ success: boolean; message?: string }> {
        const { data } = await this.http.post(this.url("start"), {});
        return data;
    }

    /** GET /api/whatsapp/{token}/status */
    async getStatus(): Promise<StatusResponse> {
        const { data } = await this.http.get(this.url("status"));
        return data as StatusResponse;
    }

    /** POST /api/whatsapp/{token}/terminate — log out of the session */
    async terminate(opts: { withDeletion?: boolean } = {}): Promise<{ success: boolean; message: string }> {
        const { data } = await this.http.post(this.url("terminate"), {
            withDeletion: opts.withDeletion ?? false
        });
        return data;
    }

    /** POST /api/whatsapp/{token}/refresh — reconnect without a full logout */
    async refreshSession(opts: { withDeletion?: boolean } = {}): Promise<{ success: boolean; message?: string }> {
        const { data } = await this.http.post(this.url("refresh"), {
            withDeletion: opts.withDeletion ?? false
        });
        return data;
    }

    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    async getQr(): Promise<QrResponse> {
        const { data } = await this.http.get(this.url("qr"));
        return data as QrResponse;
    }

    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    async getQrImage(): Promise<Buffer> {
        const { data } = await this.http.get(this.url("qr/image"), {
            responseType: "arraybuffer",
            headers: { Accept: "image/png" }
        });
        return Buffer.from(data);
    }

    /**
     * POST /api/whatsapp/{token}/sendMessage
     * Canonical body: { chatId, type: "text", text, idempotencyKey?, windowMs?, mode? }
     *
     * `chatId` takes raw digits or a contact (`@c.us`), group (`@g.us`) or
     * channel (`@newsletter`) id.
     *
     * Signed with `X-API-Timestamp` and `X-API-Signature`
     * (HMAC-SHA256 of timestamp + token + raw request body).
     */
    async sendMessage(chatId: string, text: string, options: SendOptions = {}): Promise<SendResponse> {
        const body = {
            chatId: this.normalizeChatId(chatId),
            type: "text" as MessageContentType,
            text,
            ...this.sendOptionsPayload(options)
        };

        return this.postSignedJson<SendResponse>("sendMessage", body, options.timeoutMs);
    }

    /**
     * POST /api/whatsapp/{token}/sendMedia
     * Canonical body: { chatId, type: "media" | "file", caption?, media, idempotencyKey?, windowMs?, mode? }
     *
     * `media` accepts a file path, a Buffer (multipart upload), or an inline
     * `{ mimetype, filename, base64 }` payload (JSON upload).
     *
     * `type` is inferred from the mime type when omitted: image/video/audio
     * become `media`, everything else becomes `file`. Channels (`@newsletter`)
     * do not accept `file`.
     */
    async sendMedia(params: {
        /** Target chat id. `phone` is accepted as a legacy alias. */
        chatId?: string;
        /** @deprecated use `chatId` */
        phone?: string;
        media: MediaInput;
        caption?: string;
        /** Filename override for path/Buffer uploads. */
        filename?: string;
        /** Mime type override for path/Buffer uploads. */
        mimetype?: string;
        /** Force the canonical content type instead of inferring it. */
        type?: Exclude<MessageContentType, "text">;
    } & SendOptions): Promise<SendResponse> {
        const { chatId, phone, media, caption, filename, mimetype, type } = params;
        const target = this.normalizeChatId(chatId ?? phone ?? "");

        if (isMediaPayload(media)) {
            const resolvedType = this.resolveMediaType(type, media.mimetype, media.filename);
            this.assertTypeSupported(target, resolvedType);

            const body = {
                chatId: target,
                ...(resolvedType ? { type: resolvedType } : {}),
                ...(caption ? { caption } : {}),
                media: {
                    mimetype: media.mimetype,
                    filename: media.filename,
                    base64: media.base64
                },
                ...this.sendOptionsPayload(params)
            };

            return this.postSignedJson<SendResponse>("sendMedia", body, params.timeoutMs);
        }

        const resolvedFilename = filename ?? (typeof media === "string" ? path.basename(media) : "media");
        const resolvedType = this.resolveMediaType(type, mimetype, resolvedFilename);
        this.assertTypeSupported(target, resolvedType);

        const form = new FormData();
        form.append("chatId", target);
        if (resolvedType) form.append("type", resolvedType);
        if (caption) form.append("caption", caption);

        const optionsPayload = this.sendOptionsPayload(params);
        for (const [key, value] of Object.entries(optionsPayload)) {
            form.append(key, String(value));
        }

        const fileOptions = {
            filename: resolvedFilename,
            ...(mimetype ? { contentType: mimetype } : {})
        };

        if (Buffer.isBuffer(media)) {
            form.append("media", media, fileOptions);
        } else {
            form.append("media", fs.createReadStream(media), fileOptions);
        }

        // Multipart bodies are not readable by the API when it verifies the
        // signature, so the signed payload uses an empty body.
        const { data } = await this.http.post(this.url("sendMedia"), form, {
            headers: { ...form.getHeaders(), ...this.signedHeaders("") },
            ...(params.timeoutMs ? { timeout: params.timeoutMs } : {}),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        return data as SendResponse;
    }

    /** POST /api/whatsapp/{token}/invite-info — resolve a group invite code */
    async getInviteInfo(inviteCode: string): Promise<InviteInfoResponse> {
        return this.postSignedJson<InviteInfoResponse>("invite-info", { inviteCode });
    }

    /**
     * POST /api/whatsapp/{token}/channel-info
     * Resolves a newsletter invite link or code into an `@newsletter` chat id.
     */
    async getChannelInfo(params: { inviteLink?: string; inviteCode?: string }): Promise<ChannelInfoResponse> {
        if (!params.inviteLink && !params.inviteCode) {
            throw new Error("getChannelInfo requires inviteLink or inviteCode");
        }
        return this.postSignedJson<ChannelInfoResponse>("channel-info", {
            ...(params.inviteLink ? { inviteLink: params.inviteLink } : {}),
            ...(params.inviteCode ? { inviteCode: params.inviteCode } : {})
        });
    }

    /** GET /api/whatsapp/{token}/deferred — backlog depth and next scheduled send */
    async getDeferredQueue(): Promise<DeferredQueueResponse> {
        const { data } = await this.http.get(this.url("deferred"), {
            headers: this.signedHeaders("")
        });
        return data as DeferredQueueResponse;
    }

    /** GET /api/whatsapp/{token}/deferred/{deliveryKey} — status of one queued message */
    async getDeferredMessage(deliveryKey: string): Promise<DeferredMessageResponse> {
        const { data } = await this.http.get(this.url(`deferred/${encodeURIComponent(deliveryKey)}`), {
            headers: this.signedHeaders("")
        });
        return data as DeferredMessageResponse;
    }

    /** DELETE /api/whatsapp/{token}/deferred/{deliveryKey} — cancel and refund */
    async cancelDeferredMessage(deliveryKey: string): Promise<DeferredCancelResponse> {
        const { data } = await this.http.delete(this.url(`deferred/${encodeURIComponent(deliveryKey)}`), {
            headers: this.signedHeaders("")
        });
        return data as DeferredCancelResponse;
    }

    /** Target kind the API will derive from a chat id. */
    static targetTypeOf(chatId: string): MessageTargetType {
        const value = chatId.trim().toLowerCase();
        if (value.endsWith("@g.us")) return "group";
        if (value.endsWith("@newsletter")) return "channel";
        return "contact";
    }

    private url(action: string): string {
        return `/api/whatsapp/${this.token}/${action}`;
    }

    /** HMAC-SHA256 over timestamp + token + raw request body. */
    private signedHeaders(rawBody: string): Record<string, string> {
        const timestamp = Date.now().toString();
        const signature = crypto
            .createHmac("sha256", this.secret)
            .update(timestamp + this.token + rawBody)
            .digest("hex");

        return {
            "X-API-Timestamp": timestamp,
            "X-API-Signature": signature
        };
    }

    /**
     * Signs the exact bytes that go on the wire — the body is serialized here
     * and sent as a string so axios cannot re-serialize it differently.
     */
    private async postSignedJson<T>(action: string, body: unknown, timeoutMs?: number): Promise<T> {
        const rawBody = JSON.stringify(body);

        const { data } = await this.http.post(this.url(action), rawBody, {
            headers: {
                ...this.signedHeaders(rawBody),
                "Content-Type": "application/json"
            },
            ...(timeoutMs ? { timeout: timeoutMs } : {})
        });

        return data as T;
    }

    private sendOptionsPayload(options: SendOptions): Record<string, string | number> {
        return {
            ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
            ...(options.windowMs !== undefined ? { windowMs: options.windowMs } : {}),
            ...(options.mode ? { mode: options.mode } : {})
        };
    }

    private normalizeChatId(chatId: string): string {
        const value = String(chatId ?? "").trim().replace(/^\+/, "");

        if (!CHAT_ID_PATTERN.test(value)) {
            throw new Error(
                "chatId must be digits only (e.g. 9639XXXXXXXX) or end with @c.us, @g.us or @newsletter"
            );
        }

        return value;
    }

    /** Mirrors the API rule: channels reject documents. */
    private assertTypeSupported(chatId: string, type?: MessageContentType): void {
        if (type === "file" && DigiChat.targetTypeOf(chatId) === "channel") {
            throw new Error("channels (@newsletter) do not accept 'file' messages, send 'media' instead");
        }
    }

    /**
     * image/video/audio become `media`, anything else `file`. Returns undefined
     * when the mime type is unknown so the API can infer it from the upload.
     */
    private resolveMediaType(
        explicit?: Exclude<MessageContentType, "text">,
        mimetype?: string,
        filename?: string
    ): Exclude<MessageContentType, "text"> | undefined {
        if (explicit) return explicit;

        const mime = (mimetype ?? guessMimeType(filename))?.split(";")[0].trim().toLowerCase();
        if (!mime) return undefined;

        return /^(image|video|audio)\//.test(mime) ? "media" : "file";
    }
}

const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    webm: "video/webm",
    "3gp": "video/3gpp",
    avi: "video/x-msvideo",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/opus",
    wav: "audio/wav",
    amr: "audio/amr",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed"
};

function guessMimeType(filename?: string): string | undefined {
    if (!filename) return undefined;
    const ext = path.extname(filename).replace(".", "").toLowerCase();
    return MIME_BY_EXTENSION[ext];
}

function isMediaPayload(media: MediaInput): media is MediaPayload {
    return (
        typeof media === "object" &&
        media !== null &&
        !Buffer.isBuffer(media) &&
        typeof (media as MediaPayload).base64 === "string"
    );
}

export { DigiChatError };
export * from "./types";
export default DigiChat;
