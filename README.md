# Direct File Distribution & Payload Hosting Engine

Direct file delivery engine with randomized obfuscated routing and client-side protection.

## Direct Link Structure
```
https://<domain>/api/<token>/<filename>
```
Example:
```
https://your-host.onrender.com/api/7d8a9f4c3b2e/launcher.exe
```

## Features
- **Any File Support**: Direct binary streaming for `.exe`, `.dll`, `.zip`, `.bin`, `.iso`, and custom extensions without browser execution blocking.
- **Direct Stream Delivery**: Sets appropriate headers (`Content-Disposition: attachment`, `application/octet-stream`, `Cache-Control`) for instant one-click download.
- **Obfuscation Pipeline**: Built-in script using `javascript-obfuscator` with RC4 string arrays, control-flow flattening, and dead code injection for both frontend and backend.
- **Self-Contained Storage**: Local disk storage under `data/uploads/` with metadata index.

---

## Local Setup & Testing

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm start
   ```
   Open `http://localhost:3000`

3. Build obfuscated release:
   ```bash
   npm run build:obfuscate
   ```

4. Run obfuscated production build:
   ```bash
   npm run prod
   ```

---

## Free Permanent 24/7 Hosting Options

### Option 1: Render.com (Free Web Service)
1. Push this folder to a GitHub repository.
2. Sign up at [Render](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Configure:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:obfuscate`
   - **Start Command**: `node dist/server.js`
   - **Plan**: Free
6. Render will assign a free permanent URL (e.g., `https://your-app.onrender.com`).
   Your direct download URLs will automatically format as:
   `https://your-app.onrender.com/api/<random_id>/payload.exe`

### Option 2: Koyeb (Free Tier)
1. Sign up at [Koyeb](https://koyeb.com).
2. Create an App via GitHub or Dockerfile.
3. Koyeb builds from the provided `Dockerfile` and deploys globally with HTTPS.

### Option 3: Glitch / Railway
- **Glitch**: Import directly from Git, runs Node.js permanently.
- **Railway**: 500 hours/month free or trial credits, automatic Docker deployment.
