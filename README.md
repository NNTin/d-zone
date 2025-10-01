# D-Zone (Client-Only Fork)

![D-Zone Preview](http://i.imgur.com/PLh059j.gif)

**D-Zone** is a graphical, isometric simulation that visualizes Discord users as autonomous agents in a virtual world based on real-time activity.

This is a fork of the original [d-zone](https://github.com/vegeta897/d-zone) project. The client has been rewritten in **TypeScript**, using **ES Modules**, and is designed for versioned static deployment (see [GitHub Pages](https://github.com/nntin/d-zone/tree/gh-pages)).

> ⚠️ The backend has been completely separated and rewritten in Python:
> 👉 [**nntin/d-back**](https://github.com/nntin/d-back)

---

## 🌐 Live Demo

> [🔗 View on GitHub Pages](https://nntin.github.io/d-zone)

---

## ✨ What's New in This Fork?

### ✅ Implemented

- Full TypeScript rewrite
- ES Module (ESM) support
- OAuth2 login flow handled by external backend
- GitHub Pages [versioned deployment](https://github.com/NNTin/d-zone/tree/gh-pages)
- custom WebSocket URL

### 🧪 Planned / In Progress

- Unit testing (with Vitest)
- E2E testing (with Playwright)
- Vercel deployment (for previewing webclient + allure test report)

The progress of that can be seen in the [develop](https://github.com/NNTin/d-zone/tree/develop) branch or [feature/e2e](https://github.com/NNTin/d-zone/tree/feature/e2e)

> ⚠️ Because of the unstable develop branch PR are also accepted into master. Develop is however preferred.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Build the Client

```bash
npm run build:prod
```
The built client is output to dist/static/. This is what you'll deploy to your static host (e.g. GitHub Pages, Netlify).

### 3. Local Development

To run in development mode with live rebuild:
```bash
npm run dev
```
This concurrently:

- Bundles the client (watch mode)
- Starts a local server (server.mjs)

---

## 🔌 Backend Integration

This client communicates with the **D-Zone backend**, now implemented in Python:

> 📦 [**nntin/d-back**](https://github.com/nntin/d-back)

The backend handles:

- Discord OAuth2 authentication
- WebSocket connections
- Discord server activity monitoring

Refer to the `d-back` repository for configuration and hosting instructions.

---

## 🙏 Credits & Attribution

Originally created by [Devin Spikowski](https://github.com/vegeta897)  
Modern fork maintained by [Tin Nguyen](https://github.com/NNTin)

> “An ambient life simulation driven by user activity within a Discord server”