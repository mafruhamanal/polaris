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
```bash
cd mac
export ANTHROPIC_API_KEY=sk-ant-...
swift run
```
