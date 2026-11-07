# Quiz logic — how the UI uses it

The quiz finds what text and layout look easiest to this person. No timing, no right
answers: every round is "Which is easier to read?" with two versions side by side.
Their picks decide the settings (`scoring.ts`). Gemini only writes the results
summary. With no `GEMINI_API_KEY` everything
still works (responses say `source: "fallback"`).

## Screens

**1. Intake** — render `INTAKE_QUESTIONS` (1 multi-select question, "What makes reading hard?",
kept for context only; it doesn't change settings). Save as `answers.intake`, e.g. `{ hardest: ["letters_move"] }`.

Only save `answers.speed` if the person actually taps a speed.

**2. A/B rounds** — one reusable screen. For each round in `buildRounds()`:

```ts
let t = startTournament(round.options);           // from scoring.ts
// show currentPair(t) side by side:
//   text:  SAMPLE_TEXT (from questions.ts)
//   style: settingsToStyle({ ...soFar, ...option.patch })   // soFar = buildProfile(answers).settings
// on click: t = pick(t, clickedOption); repeat until currentPair(t) is null
answers.picks[round.id] = { optionId: t.champion.id, wins: championWins(t) };
```

Rounds, in order: font (4 options) → background (3) → text size (4) → letter/word spacing (4)
→ line spacing (3). That's 13 quick clicks in total. Rendering with
`soFar` means each round shows text in the settings already picked.

Tips: keep the samples short, show `round.prompt` above them, read the prompt aloud,
make each sample one big clickable card, and add a "They look the same" button that
just keeps the current champion (`pick(t, pair[0])`).

**3. Voice + speed** — `VOICES` (from `lib/settings.ts`), `VOICE_SAMPLE`, `SPEED_CHOICES` → `answers.voice`, `answers.speed`.
These are macOS voices (the first is `null` = the Mac's default). To play a sample on the web, use the
browser's `speechSynthesis` and look for a voice with the same name (Samantha, Daniel, Karen); Safari on a
Mac has them.

## Results screen

```ts
const res = await fetch("/api/quiz", { method: "POST", body: JSON.stringify({ action: "profile", answers }) });
const { settings, profile, summary, perSetting } = await res.json();
// settings → PUT /api/settings ("Save to Polaris"). Send it as the body as-is; it's the
//            exact object the Mac app reads (see SavedSettings in lib/settings.ts).
// profile  → use for the results screen (profile.settings + settingsToStyle for the preview,
//            profile.evidence for the reasons)
// summary  → show it and read it aloud
```

Other action (not part of the quiz): `{ action: "levels", text }` rewrites any text at
original / simpler / simplest, for the simplify feature.
