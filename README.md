# digichat-js

Node.js client SDK for the [DigiChat WhatsApp API](https://chat.digiworld-dev.com).


---

## 📦 Installation

```bash
npm install digichat-js
# or
yarn add digichat-js
```

---

## 🚀 Quick Start

```js
const { DigiChat } = require("digichat-js");

const client = new DigiChat({
  token: process.env.DIGICHAT_API_TOKEN,   // token provided in your panel
  secret: process.env.DIGICHAT_API_SECRET, // secret key used for HMAC signing
});

(async () => {
  // Ping API
  console.log(await client.ping());

  // Get session status
  console.log(await client.getStatus());

  // Send a WhatsApp message
  const result = await client.sendMessage("963912345678", "Hello from Node!");
  console.log(result.messageId);
})();
```

---

## 🔑 Authentication

All requests require:

- `token` → passed in the URL path
- `secret` → used to generate an **HMAC-SHA256** signature

Signed endpoints (`sendMessage`, `sendMedia`, `invite-info`, `channel-info`,
`deferred/*`) automatically get these headers:

- `X-API-Timestamp` → Unix ms timestamp
- `X-API-Signature` → `HMAC-SHA256(timestamp + token + rawRequestBody)`

Multipart uploads sign an **empty** body, matching what the API can read back.

---

## 💬 Message contract

Sends use the canonical contract:

| field | notes |
|---|---|
| `chatId` | raw digits or `…@c.us` (contact), `…@g.us` (group), `…@newsletter` (channel) |
| `type` | `text` \| `media` \| `file` |
| `text` | required for `type: text` |
| `caption` | optional for `media` / `file` |
| `media` | multipart file, or `{ mimetype, filename, base64 }` |
| `idempotencyKey` | optional dedupe key |
| `windowMs` | optional outbox window while the session is offline |
| `mode` | `immediate` (default) \| `deferred` |

Legacy `phone` / `message` bodies are still accepted by the API, and
`sendMessage(phone, text)` keeps working unchanged.

---

## 📚 API Methods

### `ping()`
Check API availability.

```js
await client.ping();
```

---

### `startSession()` / `getStatus()` / `refreshSession()` / `terminate()`

```js
await client.startSession();

await client.getStatus();
/*
{ success: true, state: "CONNECTED", message: "session_connected" }
*/

await client.refreshSession();                     // reconnect, keep session data
await client.refreshSession({ withDeletion: true }); // wipe local data first

await client.terminate();                          // log out
await client.terminate({ withDeletion: true });    // log out + delete session data
```

---

### `getQr()` / `getQrImage()`

```js
await client.getQr();

const png = await client.getQrImage();
require("fs").writeFileSync("qr.png", png);
```

---

### `sendMessage(chatId, text, options?)`

```js
// contact
await client.sendMessage("963912345678", "Hello from DigiChat!");

// group
await client.sendMessage("123456789@g.us", "Hello team");

// channel
await client.sendMessage("123456789@newsletter", "Hello subscribers");

// with options
await client.sendMessage("963912345678", "Hi", {
  idempotencyKey: "order-1042",
  windowMs: 300000,
});
```

Immediate answer:

```json
{
  "success": true,
  "mode": "immediate",
  "online": true,
  "idempotencyKey": "order-1042",
  "chatId": "963912345678",
  "targetType": "contact",
  "contentType": "text",
  "messageId": "ABC123456",
  "queued": false,
  "duplicate": false
}
```

> `queued: true` means the session was offline and the API buffered the message
> in its outbox for `windowMs`.

---

### `sendMedia(params)`

```js
// from a file path
await client.sendMedia({
  chatId: "963912345678",
  media: "./invoice.pdf",
  caption: "Your invoice",
});

// from a Buffer
await client.sendMedia({
  chatId: "123456789@g.us",
  media: fs.readFileSync("./photo.jpg"),
  filename: "photo.jpg",
  mimetype: "image/jpeg",
});

// inline base64 (JSON upload, no multipart)
await client.sendMedia({
  chatId: "963912345678",
  media: {
    mimetype: "image/png",
    filename: "poster.png",
    base64: "iVBORw0KGgoAAAANSUhEUgAA...",
  },
});
```

`type` is inferred from the mime type — `image/*`, `video/*` and `audio/*`
become `media`, everything else becomes `file`. Pass `type` explicitly to
override. Channels (`@newsletter`) do not accept `file` messages.

---

### Deferred (queued) sending

`mode: "deferred"` accepts the message immediately (HTTP `202`) and sends it
later with a randomized per-token delay. Requires a plan carrying the deferred
sending feature.

```js
const queued = await client.sendMessage("963912345678", "Hello", {
  mode: "deferred",
  idempotencyKey: "campaign-7-1042",
});
/*
{
  success: true,
  mode: "deferred",
  status: "queued",
  queued: true,
  delivery_key: "campaign-7-1042",
  estimated_send_at: "2026-07-28T10:15:03+00:00",
  queue_position: 42
}
*/

await client.getDeferredQueue();                      // depth + next ETA
await client.getDeferredMessage(queued.delivery_key); // status, attempts, wa_message_id
await client.cancelDeferredMessage(queued.delivery_key); // cancel + refund
```

TypeScript narrowing helper:

```ts
import { isDeferredSendResponse } from "digichat-js";

const res = await client.sendMessage(chatId, text, { mode: "deferred" });
if (isDeferredSendResponse(res)) console.log(res.delivery_key);
else console.log(res.messageId);
```

---

### `getInviteInfo(inviteCode)` / `getChannelInfo(params)`

```js
await client.getInviteInfo("AbCdEfGhIjK");

const info = await client.getChannelInfo({
  inviteLink: "https://whatsapp.com/channel/AbCdEfGhIjK",
});
await client.sendMessage(info.channelInfo.channelId, "Hello subscribers");
```

---

## ⚠️ Error handling

Non-2xx answers throw a `DigiChatError`:

```js
const { DigiChatError } = require("digichat-js");

try {
  await client.sendMessage("963912345678", "Hi");
} catch (err) {
  if (err instanceof DigiChatError) {
    console.log(err.status);     // 402
    console.log(err.code);       // "insufficient_balance"
    console.log(err.message);    // "Insufficient balance"
    console.log(err.details);    // { cost, available, ... }
    console.log(err.retryAfter); // seconds, on 429
  }
}
```

Common codes: `invalid_signature`, `insufficient_balance`, `no_api_access`,
`rate_limit_exceeded`, `plan_limit_reached`, `deferred_not_available`,
`deferred_queue_full`, `session_not_ready`, `server_down`.

---

## 🔁 Upgrading from 1.0.x

- `sendMessage(phone, message)` is unchanged; a third `options` argument was added.
- `sendMedia({ phone, media })` still works — `chatId` is the new name and adds
  group/channel targets, `type`, `idempotencyKey`, `windowMs` and `mode`.
- `terminate()` can now be called with no argument (`terminate({ withDeletion })`
  is still supported).
- Read `messageId` instead of `message_id`.
- Errors are `DigiChatError` instances carrying `status`, `code` and `details`.

---
⚠️ **Disclaimer**: DigiChat uses **unofficial access** to WhatsApp. Your account may get banned. Use at your own risk.

---

## 📄 License

MIT © [Inferno-Team](https://github.com/Inferno-Team)
