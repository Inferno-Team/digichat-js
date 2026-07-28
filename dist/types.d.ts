export type SessionState = "CONNECTED" | "DISCONNECTED" | "QR" | "UNKNOWN";
/** Canonical message content type accepted by the API. */
export type MessageContentType = "text" | "media" | "file";
/** Resolved from the chatId suffix by the API. */
export type MessageTargetType = "contact" | "group" | "channel";
/** `immediate` sends now, `deferred` queues the message for paced delivery. */
export type SendMode = "immediate" | "deferred";
/** Lifecycle of a queued (deferred) message. */
export type DeferredStatus = "pending" | "queued" | "processing" | "sent" | "failed" | "canceled";
export interface DigiChatClientOptions {
    /** Token that appears in the URL path, e.g., /api/whatsapp/{token}/... */
    token: string;
    /** Secret used to sign requests (HMAC-SHA256 over timestamp + token + raw body) */
    secret: string;
    /** Optional timeout (ms) for HTTP calls */
    timeoutMs?: number;
}
export interface ApiOk {
    success: boolean;
    [k: string]: unknown;
}
export interface StatusResponse extends ApiOk {
    state: SessionState;
    message: string;
}
export interface QrResponse {
    [k: string]: unknown;
}
/** Media sent inline as base64 instead of a multipart upload. */
export interface MediaPayload {
    mimetype: string;
    filename: string;
    base64: string;
}
/** Local file path, in-memory buffer, or an inline base64 payload. */
export type MediaInput = string | Buffer | MediaPayload;
/** Options shared by sendMessage and sendMedia. */
export interface SendOptions {
    /** Deduplication key. Also used as the deferred delivery key. */
    idempotencyKey?: string;
    /** Core outbox window (ms) for messages sent while the session is offline. */
    windowMs?: number;
    /** `deferred` queues the message and answers 202 instead of sending now. */
    mode?: SendMode;
    /** Per-call timeout override (ms), useful for large uploads. */
    timeoutMs?: number;
}
/** Answer of an immediate (synchronous) send. */
export interface ImmediateSendResponse extends ApiOk {
    mode?: "immediate";
    /** Whether the WhatsApp session was online at send time. */
    online?: boolean;
    idempotencyKey?: string;
    chatId?: string;
    targetType?: MessageTargetType;
    contentType?: MessageContentType;
    messageId?: string;
    /** True when Core buffered the message in its outbox (offline session). */
    queued?: boolean;
    /** True when the idempotency key matched an earlier send. */
    duplicate?: boolean;
    /** Billing/delivery correlation key. */
    deliveryKey?: string;
    /** Error code (see ApiErrorCode) when success is false. */
    error?: string;
    /** @deprecated legacy field, use `messageId` */
    message_id?: string;
}
/** Answer of a deferred send (HTTP 202). */
export interface DeferredSendResponse extends ApiOk {
    mode: "deferred";
    status: DeferredStatus;
    queued: true;
    delivery_key: string;
    estimated_send_at: string | null;
    queue_position: number;
}
export type SendResponse = ImmediateSendResponse | DeferredSendResponse;
/** @deprecated kept for 1.0.x compatibility, use SendResponse */
export type SendMessageResponse = SendResponse;
export declare function isDeferredSendResponse(response: SendResponse): response is DeferredSendResponse;
/** GET /deferred — queue overview for the token. */
export interface DeferredQueueResponse extends ApiOk {
    pending: number;
    processing: number;
    next_send_at: string | null;
    max_queue_depth: number;
}
/** GET /deferred/{deliveryKey} — status of a single queued message. */
export interface DeferredMessageResponse extends ApiOk {
    delivery_key: string;
    status: DeferredStatus;
    scheduled_at: string | null;
    queue_position: number;
    attempts: number;
    wa_message_id: string | null;
    sent_at: string | null;
    last_error: string | null;
}
/** DELETE /deferred/{deliveryKey} — cancellation result. */
export interface DeferredCancelResponse extends ApiOk {
    delivery_key: string;
    status: DeferredStatus;
    refunded: boolean;
}
export interface InviteInfoResponse extends ApiOk {
    inviteInfo?: Record<string, unknown>;
}
export interface ChannelInfoResponse extends ApiOk {
    channelInfo?: {
        channelId?: string;
        name?: string;
        description?: string;
        inviteCode?: string;
        inviteLink?: string;
        channelMetadata?: Record<string, unknown>;
        [k: string]: unknown;
    };
}
/** Error codes returned by the API in the `error` field. */
export type ApiErrorCode = "missing_auth_headers" | "invalid_api_key" | "token_inactive" | "invalid_signature" | "token_expired" | "invalid_token" | "unauthorized" | "insufficient_balance" | "ip_not_allowed" | "token_deleted" | "no_api_access" | "deferred_not_available" | "validation_error" | "rate_limit_exceeded" | "plan_limit_reached" | "payg_limit_reached" | "deferred_queue_full" | "internal_error" | "send_message_failed" | "send_media_failed" | "server_down" | "maintenance_mode" | "session_not_ready" | "CHANNEL_UNSUPPORTED_MESSAGE_TYPE" | (string & {});
