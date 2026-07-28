import axios, { AxiosInstance, AxiosError } from "axios";
import type { ApiErrorCode } from "./types";

/** Error thrown for any non-2xx API answer. */
export class DigiChatError extends Error {
    /** HTTP status code. */
    status?: number;
    /** Machine readable code from the `error` field, e.g. `insufficient_balance`. */
    code?: ApiErrorCode;
    /** Extra context the API attached to the failure. */
    details?: unknown;
    /** Raw response body. */
    data?: unknown;
    /** Seconds to wait before retrying (rate limited answers). */
    retryAfter?: number;

    constructor(message: string) {
        super(message);
        this.name = "DigiChatError";
    }
}

export function createHttp(baseURL: string, timeout: number, headers?: Record<string, string>): AxiosInstance {
    const client = axios.create({
        baseURL,
        timeout,
        headers: { Accept: "application/json", ...(headers ?? {}) },
    });

    client.interceptors.response.use(
        r => r,
        (err: AxiosError) => {
            if (err.response) {
                const { status, data, headers: resHeaders } = err.response;
                const body = parseBody(data) as Record<string, any> | undefined;
                const msg =
                    body?.message ||
                    body?.error ||
                    firstValidationError(body) ||
                    err.message ||
                    `HTTP ${status}`;

                const e = new DigiChatError(msg);
                e.status = status;
                e.code = body?.error;
                e.details = body?.details ?? body?.errors;
                e.data = body ?? data;

                const retryAfter = Number((resHeaders as any)?.["retry-after"]);
                if (Number.isFinite(retryAfter)) e.retryAfter = retryAfter;

                throw e;
            }
            throw err;
        }
    );

    return client;
}

/** Error answers may arrive as a Buffer when the request asked for arraybuffer. */
function parseBody(data: unknown): unknown {
    if (Buffer.isBuffer(data)) {
        try {
            return JSON.parse(data.toString("utf8"));
        } catch {
            return undefined;
        }
    }
    return data;
}

/** Laravel validation failures come back as { message, errors: { field: [msg] } }. */
function firstValidationError(body?: Record<string, any>): string | undefined {
    const errors = body?.errors;
    if (!errors || typeof errors !== "object") return undefined;
    const first = Object.values(errors)[0];
    return Array.isArray(first) ? String(first[0]) : undefined;
}
