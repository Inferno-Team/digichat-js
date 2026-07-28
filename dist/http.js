"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigiChatError = void 0;
exports.createHttp = createHttp;
const axios_1 = __importDefault(require("axios"));
/** Error thrown for any non-2xx API answer. */
class DigiChatError extends Error {
    /** HTTP status code. */
    status;
    /** Machine readable code from the `error` field, e.g. `insufficient_balance`. */
    code;
    /** Extra context the API attached to the failure. */
    details;
    /** Raw response body. */
    data;
    /** Seconds to wait before retrying (rate limited answers). */
    retryAfter;
    constructor(message) {
        super(message);
        this.name = "DigiChatError";
    }
}
exports.DigiChatError = DigiChatError;
function createHttp(baseURL, timeout, headers) {
    const client = axios_1.default.create({
        baseURL,
        timeout,
        headers: { Accept: "application/json", ...(headers ?? {}) },
    });
    client.interceptors.response.use(r => r, (err) => {
        if (err.response) {
            const { status, data, headers: resHeaders } = err.response;
            const body = parseBody(data);
            const msg = body?.message ||
                body?.error ||
                firstValidationError(body) ||
                err.message ||
                `HTTP ${status}`;
            const e = new DigiChatError(msg);
            e.status = status;
            e.code = body?.error;
            e.details = body?.details ?? body?.errors;
            e.data = body ?? data;
            const retryAfter = Number(resHeaders?.["retry-after"]);
            if (Number.isFinite(retryAfter))
                e.retryAfter = retryAfter;
            throw e;
        }
        throw err;
    });
    return client;
}
/** Error answers may arrive as a Buffer when the request asked for arraybuffer. */
function parseBody(data) {
    if (Buffer.isBuffer(data)) {
        try {
            return JSON.parse(data.toString("utf8"));
        }
        catch {
            return undefined;
        }
    }
    return data;
}
/** Laravel validation failures come back as { message, errors: { field: [msg] } }. */
function firstValidationError(body) {
    const errors = body?.errors;
    if (!errors || typeof errors !== "object")
        return undefined;
    const first = Object.values(errors)[0];
    return Array.isArray(first) ? String(first[0]) : undefined;
}
