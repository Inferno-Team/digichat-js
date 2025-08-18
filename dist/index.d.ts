import type { DigiChatClientOptions, StatusResponse, SendMessageResponse, QrResponse } from "./types";
export declare class DigiChat {
    private token;
    private secret;
    private baseUrl;
    private http;
    constructor(opts: DigiChatClientOptions);
    /** GET /api/whatsapp/{token}/ping */
    ping(): Promise<string | Record<string, unknown>>;
    /** GET /api/whatsapp/{token}/status */
    getStatus(): Promise<StatusResponse>;
    /** GET /api/whatsapp/{token}/terminate */
    terminate(): Promise<{
        success: boolean;
        message: string;
    }>;
    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    getQr(): Promise<QrResponse>;
    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    getQrImage(): Promise<Buffer>;
    /**
     * POST /api/whatsapp/{token}/sendMessage
     * `X-API-Timestamp`: Unix ms timestamp
     * `X-API-Signature`: HMAC-SHA256(timestamp + token + requestBody) using API secret
     * Body: { phone: "9639xxxxxxxx", message: "..." }
     */
    sendMessage(phone: string, message: string): Promise<SendMessageResponse>;
}
export default DigiChat;
