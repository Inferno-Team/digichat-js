"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeferredSendResponse = isDeferredSendResponse;
function isDeferredSendResponse(response) {
    return response.mode === "deferred";
}
