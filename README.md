# @digiworld/digichat-js

Node.js/TypeScript client for the DigiChat WhatsApp API.

## Install
```bash
npm i @digiworld/digichat-js
# or: pnpm add @digiworld/digichat-js
```
## Quick start
```js
import DigiChat from "@digiworld/digichat-js";

const client = new DigiChat({
  token: process.env.DIGICHAT_API_TOKEN!,
  secret: process.env.DIGICHAT_API_SECRET!,

});

const run = async () => {
  console.log(await client.ping());
  console.log(await client.getStatus());              // { success: true, state: "CONNECTED", ... }
  // const png = await client.getQrImage();           // Buffer with PNG QR
  const sent = await client.sendMessage("963912345678", "Hello from Node!");
  console.log(sent);                                  // { success: true, message_id: "...", ... }
};
run().catch(console.error);
```


## CommonJS
```js
const { DigiChat } = require("@digiworld/digichat-js");
```

## Environment

<code>DIGICHAT_API_TOKEN</code> – token in URL path

<code>DIGICHAT_API_SECRET</code> – HMAC secret used for sendMessage


Unofficial WhatsApp access. Accounts can be banned. Use at your own risk.