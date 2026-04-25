# Cipher

Cipher is a modern AI chat application with a clean, themeable interface and full user account support. It lets you have persistent conversations, customize the look and feel, and pick up right where you left off across any device.

## Features

- **Persistent chat history** — conversations are saved per account and synced in real time
- **User authentication** — sign up / sign in with email or Google via Firebase Auth
- **Themeable UI** — switch between dark and light modes, accent colors, font styles, bubble shapes, and density settings
- **Markdown & LaTeX rendering** — responses support rich text formatting and math equations
- **Multi-session tracking** — see active sessions across browsers and devices
- **Credits system** — each account has a usage credit balance tracked per conversation
- **MCP server support** — connect external tool servers to extend what Cipher can do

## Stack

- **Frontend** — React 18, plain CSS, Babel standalone (no build step required)
- **Backend** — Node.js HTTP server
- **Database & Auth** — Firebase Firestore + Firebase Authentication
- **Hosting** — Vercel

## Getting Started

**Prerequisites:** Node.js

1. Clone the repo:
   ```bash
   git clone https://github.com/vatistasdimitris01/Cipher.git
   cd Cipher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node server.js
   ```

4. Open `http://localhost:8080` in your browser.

## Customization

All UI preferences (theme, accent, font, bubble shape, text size, density) are saved per user account and applied automatically on login. You can also adjust them live from the settings panel without refreshing.
