# Polaris

Select text anywhere on your Mac, draw a circle with the cursor, and get help reading it.

- `web/` — Next.js web app + API (quiz, saved responses, settings, auth)
- `mac/` — Swift menu bar app (cursor gesture, popup, reader)

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
export POLARIS_API_URL=http://localhost:3000   # the web app (Ask, Simplify, settings, Connect)
swift run
```

As a real app, so the web app's Connect page can open it with a polaris:// link:
```bash
mac/scripts/build-app.sh --open    # builds mac/build/Polaris.app with POLARIS_API_URL, then opens it
```
Then ★ in the menu bar → Connect Account, sign in, and click **Open Polaris**. Turn on
Polaris under System Settings → Privacy & Security → Accessibility (again after rebuilding,
since the free local signature changes each build).
