"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigiChat = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const http_1 = require("./http");
// const DEFAULT_BASE = "https://whatsapp-api.test";
const DEFAULT_BASE = "https://chat.digiworld-dev.com";
class DigiChat {
    token;
    secret;
    baseUrl;
    http;
    constructor(opts) {
        this.token = opts.token;
        this.secret = opts.secret;
        this.baseUrl = DEFAULT_BASE;
        this.http = (0, http_1.createHttp)(this.baseUrl, opts.timeoutMs ?? 15000);
    }
    /** GET /api/whatsapp/{token}/ping */
    async ping() {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/ping`);
        return data;
    }
    /** GET /api/whatsapp/{token}/status */
    async getStatus() {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/status`);
        return data;
    }
    /** GET /api/whatsapp/{token}/terminate */
    async terminate() {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/terminate`);
        return data;
    }
    /** GET /api/whatsapp/{token}/qr  (returns QR code data) */
    async getQr() {
        const { data } = await this.http.get(`/api/whatsapp/${this.token}/qr`);
        return data;
    }
    /** GET /api/whatsapp/{token}/qr/image (returns PNG bytes) */
    async getQrImage() {
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
    async sendMessage(phone, message) {
        if (!/^\d{10,15}$/.test(phone)) {
            throw new Error("phone must be digits only, E.164 without '+', e.g. 9639XXXXXXXX");
        }
        const body = { phone, message };
        const timestamp = Date.now().toString();
        const payload = timestamp + this.token + JSON.stringify(body);
        const signature = node_crypto_1.default.createHmac("sha256", this.secret).update(payload).digest("hex");
        const { data } = await this.http.post(`/api/whatsapp/${this.token}/sendMessage`, body, {
            headers: {
                "X-API-Timestamp": timestamp,
                "X-API-Signature": signature,
                "Content-Type": "application/json"
            }
        });
        return data;
    }
}
exports.DigiChat = DigiChat;
exports.default = DigiChat;
