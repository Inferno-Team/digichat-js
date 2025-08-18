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
  secret: process.env.DIGICHAT_API_SECRET // secret key used for HMAC signing
});

(async () => {
  // Ping API
  console.log(await client.ping());

  // Get session status
  console.log(await client.getStatus());

  // Send a WhatsApp message
  const result = await client.sendMessage("963912345678", "Hello from Node!");
  console.log(result);
})();
```

---

## 🔑 Authentication

All requests require:

- `token` → passed in the URL path
- `secret` → used to generate an **HMAC-SHA256** signature for `sendMessage`

For `sendMessage`, the SDK automatically sets these headers:

- `X-API-Timestamp`
- `X-API-Signature`

---

## 📚 API Methods

### `ping()`
Check API availability.

```js
await client.ping();
// => "pong"
```

---

### `getStatus()`
Get WhatsApp session status.

```js
await client.getStatus();
/*
{
  success: true,
  state: "CONNECTED", // or "DISCONNECTED", "QR", ...
  message: "Session is connected"
}
*/
```

---

### `terminate()`
Terminate the current WhatsApp session.

```js
await client.terminate();
```

---

### `getQr()`
Get QR code data for scanning.

```js
await client.getQr();
```

---

### `getQrImage()`
Get QR code as a PNG buffer.

```js
const png = await client.getQrImage();
// Save to file if needed:
require("fs").writeFileSync("qr.png", png);
```

---

### `sendMessage(phone, message)`
Send a WhatsApp message.

```js
await client.sendMessage("963912345678", "Hello from DigiChat!");
/*
{
  success: true,
  message_id: "...",
  message: "Message sent successfully"
}
*/
```

> **Note**: Phone numbers must be in **digits only**, without `+`  
> Example: `9639XXXXXXXX` ✅


---
⚠️ **Disclaimer**: DigiChat uses **unofficial access** to WhatsApp. Your account may get banned. Use at your own risk.

---

## 📄 License

MIT © [Inferno-Team](https://github.com/Inferno-Team)
