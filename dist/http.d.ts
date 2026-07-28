import { AxiosInstance } from "axios";
import type { ApiErrorCode } from "./types";
/** Error thrown for any non-2xx API answer. */
export declare class DigiChatError extends Error {
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
    constructor(message: string);
}
export declare function createHttp(baseURL: string, timeout: number, headers?: Record<string, string>): AxiosInstance;
