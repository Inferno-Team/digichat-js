"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigiChatError = exports.DigiChat = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const form_data_1 = __importDefault(require("form-data"));
const http_1 = require("./http");
Object.defineProperty(exports, "DigiChatError", { enumerable: true, get: function () { return http_1.DigiChatError; } });
const DEFAULT_BASE = "https://digichat.digiworld-dev.com";
/** Raw digits (contact), or a full chat id ending with @c.us, @g.us or @newsletter. */
const CHAT_ID_PATTERN = /^\d+(?:@(?:c\.us|g\.us|newsletter))?$/;
class DigiChat {
    token;
    secret;
    baseUrl;
    http;
    constructor(opts) {
        this.token = opts.token;
        this.secret = opts.secret;
        this.baseUrl = DEFAULT_BASE;
        this.http = (0, http_1.createHttp)(this.baseUrl, opts.timeoutMs ?? 15_000);
    }
    /** GET /api/whatsapp/{token}/ping */
    async ping() {
        const { data } = await this.http.get(this.url("ping"));
        return data;
    }
    /** POST /api/whatsapp/{token}/start — start or resume the session */
    async startSession() {
        const { data } = await this.http.post(this.url("start"), {});
        return data;
    }
    /** GET /api/whatsapp/{token}/status */
    async getStatus() {
        const { data } = await this.http.get(this.url("status"));
        return data;
    }
    /** POST /api/whatsapp/{token}/terminate — log out of the session */
    async terminate(opts = {}) {
        const { data } = await this.http.post(this.url("terminate"), {
            withDeletion: opts.withDeletion ?? false
        });
        return data;
    }
    /** POST /api/whatsapp/{token}/refresh — reconnect without a full logout */
    async refreshSession(opts = {}) {
        const { data } = await this.http.post(this.url("refresh"), {
            withDeletion: opts.withDeletion ?? false
        });
        return data;
    }
    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    async getQr() {
        const { data } = await this.http.get(this.url("qr"));
        return data;
    }
    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    async getQrImage() {
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
    async sendMessage(chatId, text, options = {}) {
        const body = {
            chatId: this.normalizeChatId(chatId),
            type: "text",
            text,
            ...this.sendOptionsPayload(options)
        };
        return this.postSignedJson("sendMessage", body, options.timeoutMs);
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
    async sendMedia(params) {
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
            return this.postSignedJson("sendMedia", body, params.timeoutMs);
        }
        const resolvedFilename = filename ?? (typeof media === "string" ? node_path_1.default.basename(media) : "media");
        const resolvedType = this.resolveMediaType(type, mimetype, resolvedFilename);
        this.assertTypeSupported(target, resolvedType);
        const form = new form_data_1.default();
        form.append("chatId", target);
        if (resolvedType)
            form.append("type", resolvedType);
        if (caption)
            form.append("caption", caption);
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
        }
        else {
            form.append("media", node_fs_1.default.createReadStream(media), fileOptions);
        }
        // Multipart bodies are not readable by the API when it verifies the
        // signature, so the signed payload uses an empty body.
        const { data } = await this.http.post(this.url("sendMedia"), form, {
            headers: { ...form.getHeaders(), ...this.signedHeaders("") },
            ...(params.timeoutMs ? { timeout: params.timeoutMs } : {}),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        return data;
    }
    /** POST /api/whatsapp/{token}/invite-info — resolve a group invite code */
    async getInviteInfo(inviteCode) {
        return this.postSignedJson("invite-info", { inviteCode });
    }
    /**
     * POST /api/whatsapp/{token}/channel-info
     * Resolves a newsletter invite link or code into an `@newsletter` chat id.
     */
    async getChannelInfo(params) {
        if (!params.inviteLink && !params.inviteCode) {
            throw new Error("getChannelInfo requires inviteLink or inviteCode");
        }
        return this.postSignedJson("channel-info", {
            ...(params.inviteLink ? { inviteLink: params.inviteLink } : {}),
            ...(params.inviteCode ? { inviteCode: params.inviteCode } : {})
        });
    }
    /** GET /api/whatsapp/{token}/deferred — backlog depth and next scheduled send */
    async getDeferredQueue() {
        const { data } = await this.http.get(this.url("deferred"), {
            headers: this.signedHeaders("")
        });
        return data;
    }
    /** GET /api/whatsapp/{token}/deferred/{deliveryKey} — status of one queued message */
    async getDeferredMessage(deliveryKey) {
        const { data } = await this.http.get(this.url(`deferred/${encodeURIComponent(deliveryKey)}`), {
            headers: this.signedHeaders("")
        });
        return data;
    }
    /** DELETE /api/whatsapp/{token}/deferred/{deliveryKey} — cancel and refund */
    async cancelDeferredMessage(deliveryKey) {
        const { data } = await this.http.delete(this.url(`deferred/${encodeURIComponent(deliveryKey)}`), {
            headers: this.signedHeaders("")
        });
        return data;
    }
    /** Target kind the API will derive from a chat id. */
    static targetTypeOf(chatId) {
        const value = chatId.trim().toLowerCase();
        if (value.endsWith("@g.us"))
            return "group";
        if (value.endsWith("@newsletter"))
            return "channel";
        return "contact";
    }
    url(action) {
        return `/api/whatsapp/${this.token}/${action}`;
    }
    /** HMAC-SHA256 over timestamp + token + raw request body. */
    signedHeaders(rawBody) {
        const timestamp = Date.now().toString();
        const signature = node_crypto_1.default
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
    async postSignedJson(action, body, timeoutMs) {
        const rawBody = JSON.stringify(body);
        const { data } = await this.http.post(this.url(action), rawBody, {
            headers: {
                ...this.signedHeaders(rawBody),
                "Content-Type": "application/json"
            },
            ...(timeoutMs ? { timeout: timeoutMs } : {})
        });
        return data;
    }
    sendOptionsPayload(options) {
        return {
            ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
            ...(options.windowMs !== undefined ? { windowMs: options.windowMs } : {}),
            ...(options.mode ? { mode: options.mode } : {})
        };
    }
    normalizeChatId(chatId) {
        const value = String(chatId ?? "").trim().replace(/^\+/, "");
        if (!CHAT_ID_PATTERN.test(value)) {
            throw new Error("chatId must be digits only (e.g. 9639XXXXXXXX) or end with @c.us, @g.us or @newsletter");
        }
        return value;
    }
    /** Mirrors the API rule: channels reject documents. */
    assertTypeSupported(chatId, type) {
        if (type === "file" && DigiChat.targetTypeOf(chatId) === "channel") {
            throw new Error("channels (@newsletter) do not accept 'file' messages, send 'media' instead");
        }
    }
    /**
     * image/video/audio become `media`, anything else `file`. Returns undefined
     * when the mime type is unknown so the API can infer it from the upload.
     */
    resolveMediaType(explicit, mimetype, filename) {
        if (explicit)
            return explicit;
        const mime = (mimetype ?? guessMimeType(filename))?.split(";")[0].trim().toLowerCase();
        if (!mime)
            return undefined;
        return /^(image|video|audio)\//.test(mime) ? "media" : "file";
    }
}
exports.DigiChat = DigiChat;
const MIME_BY_EXTENSION = {
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
function guessMimeType(filename) {
    if (!filename)
        return undefined;
    const ext = node_path_1.default.extname(filename).replace(".", "").toLowerCase();
    return MIME_BY_EXTENSION[ext];
}
function isMediaPayload(media) {
    return (typeof media === "object" &&
        media !== null &&
        !Buffer.isBuffer(media) &&
        typeof media.base64 === "string");
}
__exportStar(require("./types"), exports);
exports.default = DigiChat;
