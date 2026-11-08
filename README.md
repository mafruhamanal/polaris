# Polaris

Select text anywhere on your Mac, draw a circle with the cursor, and get help reading it.

- `web/` — Next.js web app + API (quiz, saved responses, settings, auth)
- `mac/` — Swift menu bar app (cursor gesture, popup, reader)

Live web app: https://polaris-khaki-three.vercel.app (Vercel, root directory `web`, deploys from `main`).

## Roles
- UI (quiz, saved responses): Lillian
- Quiz research + logic: Aria
- Backend (saved responses, OAuth): Tahmina
- Swift app: TBD
- AI (quiz, simplify): TBD

## Run the web app
```bash
cd web
cp ../.env.example .env.local   # fill in keys
npm install
npm run dev                     # http://localhost:3000
```

## Run the Mac app

Quick test (polaris:// links can't reach it, so connect with ★ → Paste Connect Token):
```bash
cd mac
export POLARIS_API_URL=http://localhost:3000   # only to use a local web app; default is the deployed site
swift run
```

As a real app, so the web app's Connect page can open it with a polaris:// link:
```bash
mac/scripts/build-app.sh --open    # builds mac/build/Polaris.app (uses the deployed site, or POLARIS_API_URL if set), then opens it
```
Then ★ in the menu bar → Connect Account, sign in, and click **Open Polaris**. Turn on
Polaris under System Settings → Privacy & Security → Accessibility (again after rebuilding,
since the free local signature changes each build).

Write (the 🎙 circle, or ★ → Write a Note…) asks for the microphone and speech recognition the
first time; it only works in the built app, not `swift run`. Read aloud uses your ElevenLabs
voice from the quiz when the web app has `ELEVENLABS_API_KEY`, and the Mac's voices otherwise.

Screenshot (the 📷 circle, or ★ → Screenshot…) lets you drag over part of the screen; its text is
read on the Mac and used by Read aloud, Ask/Simplify and Write. It needs Screen Recording
permission (System Settings → Privacy & Security → Screen & System Audio Recording).
