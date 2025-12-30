import crypto from "node:crypto";
import { createHttp } from "./http";
import type {
    DigiChatClientOptions,
    StatusResponse,
    SendMessageResponse,
    QrResponse
} from "./types";
import FormData from "form-data";
import fs from "node:fs";

const DEFAULT_BASE = "https://stagging.digichat.digiworld-dev.com";

export class DigiChat {
    private token: string;
    private secret: string;
    private baseUrl: string;
    private http;

    constructor(opts: DigiChatClientOptions) {
        this.token = opts.token;
        this.secret = opts.secret;
        this.baseUrl = DEFAULT_BASE;
        this.http = createHttp(this.baseUrl, opts.timeoutMs ?? 15000);
    }

    /** GET /api/whatsapp/{token}/ping */
    async ping(): Promise<string | Record<string, unknown>> {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/ping`);
        return data;
    }

    /** GET /api/whatsapp/{token}/status */
    async getStatus(): Promise<StatusResponse> {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/status`);
        return data as StatusResponse;
    }

    /** GET /api/whatsapp/{token}/terminate */
    async terminate({ withDeletion = false }): Promise<{ success: boolean; message: string }> {
        const { data } = await this.http.post(`/api/whatsapp/${this.token}/terminate`, {
            withDeletion
        });
        return data;
    }

    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    async getQr(): Promise<QrResponse> {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/qr`);
        return data as QrResponse;
    }

    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    async getQrImage(): Promise<Buffer> {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/qr/image`, {
            responseType: "arraybuffer",
            headers: { "Content-Type": "image/png" }
        });
        return Buffer.from(data);
    }

    /**
     * POST /api/whatsapp/{token}/sendMessage
     * `X-API-Timestamp`: Unix ms timestamp
     * `X-API-Signature`: HMAC-SHA256(timestamp + token + requestBody) using API secret
     * Body: { phone: "9639xxxxxxxx", message: "..." }
     */
    async sendMessage(phone: string, message: string): Promise<SendMessageResponse> {
        if (!/^\d{10,15}$/.test(phone)) {
            throw new Error("phone must be digits only, E.164 without '+', e.g. 9639XXXXXXXX");
        }
        const body = { phone, message };
        const timestamp = Date.now().toString();
        const payload = timestamp + this.token + JSON.stringify(body);
        const signature = crypto.createHmac("sha256", this.secret).update(payload).digest("hex");

        const { data } = await this.http.post(
            `/api/whatsapp/${this.token}/sendMessage`,
            body,
            {
                headers: {
                    "X-API-Timestamp": timestamp,
                    "X-API-Signature": signature,
                    "Content-Type": "application/json"
                }
            }
        );

        return data as SendMessageResponse;
    }

    /**
     * POST /api/whatsapp/{token}/sendMedia
     * `X-API-Timestamp`: Unix ms timestamp
     * `X-API-Signature`: HMAC-SHA256(timestamp + token + requestBody) using API secret
     * Form fields: phone, media (file), caption (optional)
     */
    async sendMedia(params: {
        phone: string;
        media: string | Buffer; // file path or Buffer
        caption?: string;
        filename?: string; // optional override for filename
    }): Promise<SendMessageResponse> {
        const { phone, media, caption, filename } = params;
        if (!/^[0-9]{10,15}$/.test(phone)) {
            throw new Error("phone must be digits only, E.164 without '+', e.g. 9639XXXXXXXX");
        }
        const form = new FormData();
        form.append("phone", phone);
        if (caption) form.append("caption", caption);
        if (Buffer.isBuffer(media)) {
            form.append("media", media, filename || "media");
        } else {
            form.append("media", fs.createReadStream(media), filename || undefined);
        }
        // For signature, use empty string for requestBody to match Postman for multipart
        const timestamp = Date.now().toString();
        const payload = timestamp + this.token + "";
        const signature = crypto.createHmac("sha256", this.secret).update(payload).digest("hex");
        const headers = {
            ...form.getHeaders(),
            "X-API-Timestamp": timestamp,
            "X-API-Signature": signature
        };
        const { data } = await this.http.post(
            `/api/whatsapp/${this.token}/sendMedia`,
            form,
            { headers }
        );
        return data as SendMessageResponse;
    }
}

export default DigiChat;
