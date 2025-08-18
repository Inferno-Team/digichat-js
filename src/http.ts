import axios, { AxiosInstance, AxiosError } from "axios";

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
                const { status, data } = err.response;
                const msg = (data as any)?.message || err.message || `HTTP ${status}`;
                const e = new Error(msg) as Error & { status?: number; data?: unknown };
                e.status = status;
                e.data = data;
                throw e;
            }
            throw err;
        }
    );

    return client;
}
