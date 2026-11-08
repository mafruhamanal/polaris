"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  buildRounds, INTAKE_QUESTIONS, SAMPLE_TEXT, SPEED_CHOICES,
  type RoundOption, type RoundId,
} from "@/lib/quiz/questions";
import {
  startTournament, currentPair, pick, championWins,
  buildProfile, type QuizAnswers, type Tournament, type RoundPick,
} from "@/lib/quiz/scoring";
import { settingsToStyle, type ReadingProfile, type SavedSettings } from "@/lib/settings";
import ProgressDots from "@/components/quiz/ProgressDots";
import QuestionCard from "@/components/quiz/QuestionCard";
import ResultsCard from "@/components/quiz/ResultsCard";

type ElevenLabsVoice = { voice_id: string; name: string; preview_url: string };

type Phase =
  | { kind: "intro" }
  | { kind: "intake" }
  | { kind: "round"; roundIndex: number; tournament: Tournament<RoundOption> }
  | { kind: "voice" }
  | { kind: "speed" }
  | { kind: "submitting" }
  | { kind: "results"; summary: string; profile: ReadingProfile; settings: SavedSettings; perSetting: Record<string, string> }
  | { kind: "done" };

const ROUNDS = buildRounds();
const TOTAL_ROUNDS = ROUNDS.length;

export default function Quiz({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [intake, setIntake] = useState<string[]>([]);
  const [picks, setPicks] = useState<Partial<Record<RoundId, RoundPick>>>({});
  const [voice, setVoice] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [applying, setApplying] = useState(false);
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);

  useEffect(() => {
    if (phase.kind === "voice" && elevenlabsVoices.length === 0) {
      fetch("/api/voices")
        .then((r) => r.json())
        .then((d) => setElevenlabsVoices(d.voices ?? []));
    }
  }, [phase.kind]);

  const answers: QuizAnswers = { intake: { hardest: intake }, picks, voice, speed };
  const soFar = buildProfile(answers).settings;

  // ---- handlers ----

  function startQuiz() {
    setPhase({ kind: "intake" });
  }

  function submitIntake() {
    setPhase({ kind: "round", roundIndex: 0, tournament: startTournament(ROUNDS[0].options) });
  }

  function handlePick(option: RoundOption) {
    if (phase.kind !== "round") return;
    const { roundIndex, tournament } = phase;
    const next = pick(tournament, option);
    const pair = currentPair(next);

    if (pair) {
      setPhase({ kind: "round", roundIndex, tournament: next });
    } else {
      const round = ROUNDS[roundIndex];
      setPicks((prev) => ({
        ...prev,
        [round.id]: { optionId: next.champion.id, wins: championWins(next) },
      }));
      const nextIndex = roundIndex + 1;
      if (nextIndex < TOTAL_ROUNDS) {
        setPhase({ kind: "round", roundIndex: nextIndex, tournament: startTournament(ROUNDS[nextIndex].options) });
      } else {
        setPhase({ kind: "voice" });
      }
    }
  }

  async function submitAnswers(finalVoice: string | null, finalSpeed: number) {
    setPhase({ kind: "submitting" });
    const finalAnswers: QuizAnswers = { intake: { hardest: intake }, picks, voice: finalVoice, speed: finalSpeed };
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", answers: finalAnswers }),
      });
      const data = await res.json();
      setPhase({
        kind: "results",
        summary: data.summary ?? "Here are your suggested settings.",
        profile: data.profile,
        settings: data.settings,
        perSetting: data.perSetting ?? {},
      });
    } catch {
      // fallback: build profile locally
      const profile = buildProfile(finalAnswers);
      setPhase({
        kind: "results",
        summary: "Here are your suggested settings based on your picks.",
        profile,
        settings: await import("@/lib/settings").then((m) => m.toSavedSettings(profile.settings)),
        perSetting: {},
      });
    }
  }

  async function handleApply(settings: SavedSettings) {
    if (!isLoggedIn) {
      router.push("/sign-in");
      return;
    }
    setApplying(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    router.push("/settings");
  }

  function playPreview(previewUrl: string) {
    new Audio(previewUrl).play();
  }

  // ---- phases ----

  if (phase.kind === "intro") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-lg mx-auto">
        <div className="text-6xl">🔭</div>
        <h1 className="text-3xl font-bold leading-tight">Find your reading settings</h1>
        <p className="text-gray-600 text-lg leading-relaxed">
          A short quiz that compares fonts, sizes, and spacing — no right or wrong answers, just what feels easier for <em>you</em>.
        </p>
        <p className="text-sm text-gray-400">About 2 minutes · 8 steps</p>
        <button
          onClick={startQuiz}
          className="bg-blue-600 text-white px-10 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          Start →
        </button>
      </div>
    );
  }

  if (phase.kind === "intake") {
    const q = INTAKE_QUESTIONS[0];
    return (
      <div className="max-w-xl mx-auto space-y-6 py-6">
        <ProgressDots total={TOTAL_ROUNDS} current={0} />
        <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">About you</p>
        <h2 className="text-2xl font-bold text-center leading-snug">{q.prompt}</h2>
        <div className="space-y-3">
          {q.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() =>
                setIntake((prev) =>
                  prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]
                )
              }
              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                intake.includes(opt.id)
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={submitIntake}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          {intake.length === 0 ? "Skip →" : "Next →"}
        </button>
      </div>
    );
  }

  if (phase.kind === "round") {
    const { roundIndex, tournament } = phase;
    const pair = currentPair(tournament);
    if (!pair) return null;
    const [a, b] = pair;
    const round = ROUNDS[roundIndex];

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        <ProgressDots total={TOTAL_ROUNDS} current={roundIndex} />
        <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">
          Round {roundIndex + 1} of {TOTAL_ROUNDS}
        </p>
        <QuestionCard
          prompt={round.prompt}
          optionA={a}
          optionB={b}
          soFar={soFar}
          onPick={handlePick}
        />
      </div>
    );
  }

  if (phase.kind === "voice") {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-6">
        <ProgressDots total={TOTAL_ROUNDS} current={TOTAL_ROUNDS} />
        <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Reading voice</p>
        <h2 className="text-2xl font-bold text-center">Which voice sounds best?</h2>
        <div className="space-y-2">
          {elevenlabsVoices.length === 0 ? (
            <p className="text-center text-gray-400">Loading voices…</p>
          ) : (
            elevenlabsVoices.map((v) => (
              <div
                key={v.voice_id}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  voice === v.voice_id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                onClick={() => setVoice(v.voice_id)}
              >
                <span className="flex-1 font-medium">{v.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); playPreview(v.preview_url); }}
                  className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  ▶ Play
                </button>
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setPhase({ kind: "speed" })}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          {voice === null ? "Skip →" : "Next →"}
        </button>
      </div>
    );
  }

  if (phase.kind === "speed") {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-6">
        <ProgressDots total={TOTAL_ROUNDS} current={TOTAL_ROUNDS} />
        <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Reading speed</p>
        <h2 className="text-2xl font-bold text-center">How fast should Polaris read?</h2>
        <div
          style={settingsToStyle(soFar)}
          className="rounded-xl p-5 shadow-sm"
        >
          <p>{SAMPLE_TEXT}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SPEED_CHOICES.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`py-3 rounded-xl border-2 font-semibold transition-all ${
                speed === s ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {s === 1 ? "1× normal" : `${s}×`}
            </button>
          ))}
        </div>
        <button
          onClick={() => submitAnswers(voice, speed)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          See my settings →
        </button>
      </div>
    );
  }

  if (phase.kind === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="text-5xl animate-bounce">⭐</div>
        <p className="text-lg text-gray-600">Analysing your picks…</p>
      </div>
    );
  }

  if (phase.kind === "results") {
    return (
      <div className="py-4">
        <ResultsCard
          profile={phase.profile}
          settings={phase.settings}
          summary={phase.summary}
          perSetting={phase.perSetting}
          onApply={handleApply}
          applying={applying}
        />
        {!isLoggedIn && (
          <p className="text-center text-sm text-gray-400 mt-4">
            You&apos;ll need to <a href="/sign-in" className="text-blue-600 underline">sign in</a> to save these settings.
          </p>
        )}
      </div>
    );
  }

  return null;
}
