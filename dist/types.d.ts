export type SessionState = "CONNECTED" | "DISCONNECTED" | "QR" | "UNKNOWN";
export interface DigiChatClientOptions {
    /** Token that appears in the URL path, e.g., /api/whatsapp/{token}/... */
    token: string;
    /** Secret used to sign the request body for POST /sendMessage */
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
export interface SendMessageResponse extends ApiOk {
    message_id?: string;
    message?: string;
}
export interface QrResponse {
    [k: string]: unknown;
}
