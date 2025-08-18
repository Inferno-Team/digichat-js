"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttp = createHttp;
const axios_1 = __importDefault(require("axios"));
function createHttp(baseURL, timeout, headers) {
    const client = axios_1.default.create({
        baseURL,
        timeout,
        headers: { Accept: "application/json", ...(headers ?? {}) },
    });
    client.interceptors.response.use(r => r, (err) => {
        if (err.response) {
            const { status, data } = err.response;
            const msg = data?.message || err.message || `HTTP ${status}`;
            const e = new Error(msg);
            e.status = status;
            e.data = data;
            throw e;
        }
        throw err;
    });
    return client;
}
