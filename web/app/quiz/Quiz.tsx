"use client";

import { useState, useEffect, useRef } from "react";
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
  const [readingLevel, setReadingLevel] = useState<"simple" | "standard" | "advanced">("standard");
  const [applying, setApplying] = useState(false);
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (phase.kind === "voice" && elevenlabsVoices.length === 0 && !loadingVoices) {
      setLoadingVoices(true);
      fetch("/api/voices")
        .then((r) => r.json())
        .then((d) => setElevenlabsVoices(d.voices ?? []))
        .finally(() => setLoadingVoices(false));
    }
  }, [phase.kind]);

  const answers: QuizAnswers = { intake: { hardest: intake }, picks, voice, speed, readingLevel };
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
    const finalAnswers: QuizAnswers = { intake: { hardest: intake }, picks, voice: finalVoice, speed: finalSpeed, readingLevel };
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
    audioRef.current?.pause();
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.play();
  }

  function playSpeedSample() {
    audioRef.current?.pause();
    const preview = elevenlabsVoices.find((v) => v.voice_id === voice)?.preview_url
      ?? elevenlabsVoices[0]?.preview_url;
    if (!preview) return;
    const audio = new Audio(preview);
    audio.playbackRate = speed;
    audioRef.current = audio;
    audio.play();
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
        <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Reading preferences</p>
        <h2 className="text-2xl font-bold text-center">Set up your reading experience</h2>

        {/* Voice */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="px-5 py-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Voice</p>
            {loadingVoices ? (
              <p className="text-sm text-gray-400 py-1">Loading voices…</p>
            ) : elevenlabsVoices.length === 0 ? (
              <p className="text-sm text-gray-400 py-1">No voices available.</p>
            ) : (
              <div className="space-y-2">
                {elevenlabsVoices.map((v) => (
                  <div
                    key={v.voice_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      voice === v.voice_id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setVoice(v.voice_id)}
                  >
                    <span className="flex-1 text-sm font-medium">{v.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); playPreview(v.preview_url); }}
                      className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      ▶ Play
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Speed */}
          <div className="px-5 py-3">
            <p className="text-sm font-medium text-gray-700 mb-3">Reading speed</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>0.5×</span>
                <span className="text-lg font-bold text-blue-600">{speed === 1 ? "1× normal" : `${speed}×`}</span>
                <span>2×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                onPointerUp={elevenlabsVoices.length > 0 ? playSpeedSample : undefined}
                className="w-full accent-blue-600"
              />
              {elevenlabsVoices.length > 0 && (
                <p className="text-xs text-gray-400">Release to hear a sample at this speed</p>
              )}
            </div>
          </div>

          {/* Reading level */}
          <div className="px-5 py-3 space-y-2">
            <p className="text-sm font-medium text-gray-700">Reading level</p>
            <div className="flex gap-2">
              {(["simple", "standard", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setReadingLevel(l)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all capitalize ${
                    readingLevel === l ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400">
              {readingLevel === "simple" && "Text is rewritten with short sentences and everyday words — easiest to read"}
              {readingLevel === "standard" && "Text is lightly simplified with clearer sentences — balanced and readable"}
              {readingLevel === "advanced" && "Text is shown as-is, with no changes — closest to the original source"}
            </p>
          </div>
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
