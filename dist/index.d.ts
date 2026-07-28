import { DigiChatError } from "./http";
import type { ChannelInfoResponse, DeferredCancelResponse, DeferredMessageResponse, DeferredQueueResponse, DigiChatClientOptions, InviteInfoResponse, MediaInput, MessageContentType, MessageTargetType, QrResponse, SendOptions, SendResponse, StatusResponse } from "./types";
export declare class DigiChat {
    private token;
    private secret;
    private baseUrl;
    private http;
    constructor(opts: DigiChatClientOptions);
    /** GET /api/whatsapp/{token}/ping */
    ping(): Promise<string | Record<string, unknown>>;
    /** POST /api/whatsapp/{token}/start — start or resume the session */
    startSession(): Promise<{
        success: boolean;
        message?: string;
    }>;
    /** GET /api/whatsapp/{token}/status */
    getStatus(): Promise<StatusResponse>;
    /** POST /api/whatsapp/{token}/terminate — log out of the session */
    terminate(opts?: {
        withDeletion?: boolean;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    /** POST /api/whatsapp/{token}/refresh — reconnect without a full logout */
    refreshSession(opts?: {
        withDeletion?: boolean;
    }): Promise<{
        success: boolean;
        message?: string;
    }>;
    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    getQr(): Promise<QrResponse>;
    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    getQrImage(): Promise<Buffer>;
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
    sendMessage(chatId: string, text: string, options?: SendOptions): Promise<SendResponse>;
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
    sendMedia(params: {
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
    } & SendOptions): Promise<SendResponse>;
    /** POST /api/whatsapp/{token}/invite-info — resolve a group invite code */
    getInviteInfo(inviteCode: string): Promise<InviteInfoResponse>;
    /**
     * POST /api/whatsapp/{token}/channel-info
     * Resolves a newsletter invite link or code into an `@newsletter` chat id.
     */
    getChannelInfo(params: {
        inviteLink?: string;
        inviteCode?: string;
    }): Promise<ChannelInfoResponse>;
    /** GET /api/whatsapp/{token}/deferred — backlog depth and next scheduled send */
    getDeferredQueue(): Promise<DeferredQueueResponse>;
    /** GET /api/whatsapp/{token}/deferred/{deliveryKey} — status of one queued message */
    getDeferredMessage(deliveryKey: string): Promise<DeferredMessageResponse>;
    /** DELETE /api/whatsapp/{token}/deferred/{deliveryKey} — cancel and refund */
    cancelDeferredMessage(deliveryKey: string): Promise<DeferredCancelResponse>;
    /** Target kind the API will derive from a chat id. */
    static targetTypeOf(chatId: string): MessageTargetType;
    private url;
    /** HMAC-SHA256 over timestamp + token + raw request body. */
    private signedHeaders;
    /**
     * Signs the exact bytes that go on the wire — the body is serialized here
     * and sent as a string so axios cannot re-serialize it differently.
     */
    private postSignedJson;
    private sendOptionsPayload;
    private normalizeChatId;
    /** Mirrors the API rule: channels reject documents. */
    private assertTypeSupported;
    /**
     * image/video/audio become `media`, anything else `file`. Returns undefined
     * when the mime type is unknown so the API can infer it from the upload.
     */
    private resolveMediaType;
}
export { DigiChatError };
export * from "./types";
export default DigiChat;
