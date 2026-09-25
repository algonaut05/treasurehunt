# ENGQUEST 5.0

Frontend foundation for the ENGQUEST 5.0 treasure hunt by Drushyam Photography Club.

## Run locally

```bash
npm install
npm run dev
```

The event-specific copy and qualification values live in `src/config/event.config.ts`.

## Local Firebase server

The Node server in `server/index.js` runs on this PC, serves the built site, and connects to Cloud Firestore with Firebase Admin SDK. It handles registration, sequential team IDs, team login, and organiser team listing. The browser never connects directly to Firestore.

1. Create a Firebase project and its default Cloud Firestore database. Firebase Authentication and Cloud Functions are not used.
2. Create a service account key for the project and save it as `firebase-service-account.json` in this project root. This file is ignored by Git. Never place it in `public` or commit it.
3. Copy `.env.example` to `.env.local`. Set `FIREBASE_PROJECT_ID`, the service account file path, and organiser credentials. Keep `.env.local` private and out of Git.
4. Build the frontend with `npm run build`, then start the local server with `npm run server`. It serves the website and API at `http://localhost:3001`.
5. For local UI development, run `npm run server` and `npm run dev` in separate terminals. Vite proxies `/api` requests to the local Node server.
6. If students access the event site over the internet, configure the existing Cloudflare Tunnel to forward to `http://localhost:3001`. Keep the PC and server running during the event.

Firestore rules deny direct browser access; the Admin SDK on the local server bypasses those rules. Team passwords are stored as plaintext in team documents, as requested for this one-day event. Avoid reusing these passwords elsewhere and keep the service-account key private.
