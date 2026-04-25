# OpenCode API Integration Guide

This guide provides the necessary information to connect any application to the **OpenCode AI API** using the same endpoint as OpenCode Zen.

## Endpoint Details

- **Base URL:** `https://opencode.ai/zen/v1`
- **Chat Completion Endpoint:** `https://opencode.ai/zen/v1/chat/completions`

## Authentication

All requests require an API Key passed in the `Authorization` header.

```http
Authorization: Bearer YOUR_OPENCODE_API_KEY
```

## API Specification

The API is fully compatible with the OpenAI SDK format.

### Request Body (JSON)

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `model` | string | The model ID to use (e.g., `nemotron-3-super-free`) |
| `messages` | array | Array of message objects: `[{ "role": "user", "content": "..." }]` |
| `stream` | boolean | Set to `true` for server-sent events (SSE) |
| `temperature`| number | Sampling temperature (0.0 to 1.0) |

### Supported Models

- `nemotron-3-super-free` (Recommended)
- `nemotron-3-super`
- `zen-1-speed`

## Implementation Example (Node.js/TypeScript)

```typescript
async function getCipherResponse(prompt: string) {
  const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENCODE_API_KEY}`
    },
    body: JSON.stringify({
      model: "nemotron-3-super-free",
      messages: [{ role: "user", content: prompt }],
      stream: false
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

## Security Best Practices

1. **Server-Side Only:** Never expose your `OPENCODE_API_KEY` in client-side code (browsers).
2. **Environment Variables:** Always store the key in an `.env` file or secret manager.
3. **Budget Limits:** Monitor your usage on the OpenCode dashboard.

---
*Guide generated for future prompt reference.*
