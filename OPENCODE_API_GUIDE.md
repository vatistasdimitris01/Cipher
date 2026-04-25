# OpenCode Zen API Connection Guide

This guide outlines how to integrate and connect to the OpenCode Zen API service using an OpenAI-compatible interface.

## 1. Authentication
All requests must include a `Bearer` token in the `Authorization` header.

- **Header**: `Authorization: Bearer <YOUR_OPENCODE_API_KEY>`
- **Content-Type**: `application/json`

## 2. API Endpoint
The service uses the following base endpoint for chat completions:

`POST https://opencode.ai/zen/v1/chat/completions`

## 3. Request Payload
The request follows the standard OpenAI Chat Completion schema.

### Standard Request Body:
```json
{
  "model": "nemotron-3-super-free",
  "messages": [
    {
      "role": "system",
      "content": "You are OpenCode Zen, a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

## 4. Valid Model Aliases
You can use the following free-tier model strings for the `model` parameter:

- `nemotron-3-super-free`
- `minimax-m2.5-free`
- `gpt-4o-mini-free`

## 5. Backend Implementation Example (Node.js)

```typescript
async function getZenResponse(messages) {
  const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENCODE_API_KEY}`
    },
    body: JSON.stringify({
      model: "nemotron-3-super-free",
      messages: messages
    })
  });

  return await response.json();
}
```

## 6. Integration Notes
- **Identity**: This guide is for OpenCode Zen, the core intelligence service.
- **Error Handling**: Monitor for `401` (Invalid Key) and `429` (Rate Limit) status codes.
