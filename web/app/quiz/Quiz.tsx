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
    router.refresh(); // re-draw the page header and colors with the new settings
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
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 max-w-4xl mx-auto">
        <div className="text-9xl">🔭</div>
        <h1 className="text-6xl font-bold leading-tight">Find your reading settings</h1>
        <p className="text-star-white text-3xl leading-relaxed">
          A short quiz that compares fonts, sizes, and spacing — no right or wrong answers, just what feels easier for <em>you</em>.
        </p>
        <p className="text-xl text-star-white" style={{ zoom: 2.25 }}>About 2 minutes · 8 steps</p>
        <button
          onClick={startQuiz}
          className="bg-nebula-teal text-space-deep px-20 py-6 rounded-full text-3xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          Start →
        </button>
      </div>
    );
  }

  if (phase.kind === "intake") {
    const q = INTAKE_QUESTIONS[0];
    return (
      <div className="max-w-xl mx-auto space-y-6 py-6" style={{ zoom: 1.875 }}>
        <ProgressDots total={TOTAL_ROUNDS} current={0} />
        <p className="text-xs text-center text-star-white font-medium uppercase tracking-wide">About you</p>
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
                  ? "border-nebula-purple bg-nebula-purple/10 text-nebula-purple"
                  : "border-space-light bg-space-mid text-star-white hover:border-nebula-purple/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={submitIntake}
          className="w-full bg-nebula-teal text-space-deep py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
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
      <div className="max-w-4xl mx-auto space-y-8 py-4" style={{ zoom: 1.875 }}>
        <ProgressDots total={TOTAL_ROUNDS} current={roundIndex} />
        <p className="text-2xl text-center text-star-white font-semibold uppercase tracking-widest">
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
      <div className="max-w-2xl mx-auto space-y-8 py-6" style={{ zoom: 1.875 }}>
        <ProgressDots total={TOTAL_ROUNDS} current={TOTAL_ROUNDS} />
        <p className="text-xl text-center text-star-white font-medium uppercase tracking-wide">Reading preferences</p>
        <h2 className="text-4xl font-bold text-center">Set up your reading experience</h2>

        {/* Voice */}
        <div className="bg-space-mid rounded-2xl border border-nebula-teal/10 shadow-sm divide-y divide-space-light">
          <div className="px-6 py-5">
            <p className="text-xl font-medium text-star-white mb-4">Voice</p>
            {loadingVoices ? (
              <p className="text-xl text-star-white py-1">Loading voices…</p>
            ) : elevenlabsVoices.length === 0 ? (
              <p className="text-xl text-star-white py-1">No voices available.</p>
            ) : (
              <div className="space-y-3">
                {elevenlabsVoices.map((v) => (
                  <div
                    key={v.voice_id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      voice === v.voice_id ? "border-nebula-teal bg-nebula-teal/10" : "border-space-light hover:border-nebula-teal/40"
                    }`}
                    onClick={() => setVoice(v.voice_id)}
                  >
                    <span className={`flex-1 text-xl font-medium ${voice === v.voice_id ? "text-nebula-teal" : "text-star-white"}`}>{v.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); playPreview(v.preview_url); }}
                      className="text-xl text-nebula-teal hover:text-star-white px-5 py-2 rounded-lg bg-nebula-teal/10 hover:bg-nebula-teal/20 transition-colors"
                    >
                      ▶ Play
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Speed */}
          <div className="px-6 py-5">
            <p className="text-xl font-medium text-star-white mb-4">Reading speed</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xl text-star-white">
                <span>0.5×</span>
                <span className="text-3xl font-bold text-nebula-teal">{speed === 1 ? "1× normal" : `${speed}×`}</span>
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
                className="w-full accent-nebula-teal"
              />
              {elevenlabsVoices.length > 0 && (
                <p className="text-lg text-star-white">Release to hear a sample at this speed</p>
              )}
            </div>
          </div>

          {/* Reading level */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xl font-medium text-star-white">Reading level</p>
            <div className="flex gap-3">
              {(["simple", "standard", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setReadingLevel(l)}
                  className={`px-6 py-3 rounded-lg text-xl font-medium border-2 transition-all capitalize ${
                    readingLevel === l ? "border-nebula-teal bg-nebula-teal/10 text-nebula-teal" : "border-space-light text-star-white hover:border-nebula-teal/40 hover:text-star-white"
                  }`}
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xl text-star-white">
              {readingLevel === "simple" && "Text is rewritten with short sentences and everyday words — easiest to read"}
              {readingLevel === "standard" && "Text is lightly simplified with clearer sentences — balanced and readable"}
              {readingLevel === "advanced" && "Text is shown as-is, with no changes — closest to the original source"}
            </p>
          </div>
        </div>

        <button
          onClick={() => submitAnswers(voice, speed)}
          className="w-full bg-nebula-teal text-space-deep py-5 rounded-xl text-2xl font-semibold hover:opacity-90 transition-opacity"
        >
          See my settings →
        </button>
      </div>
    );
  }

  if (phase.kind === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4" style={{ zoom: 1.875 }}>
        <div className="text-5xl animate-bounce">⭐</div>
        <p className="text-xl text-star-white">Analysing your picks…</p>
      </div>
    );
  }

  if (phase.kind === "results") {
    return (
      <div className="py-4" style={{ zoom: 1.875 }}>
        <ResultsCard
          profile={phase.profile}
          settings={phase.settings}
          perSetting={phase.perSetting}
          onApply={handleApply}
          applying={applying}
        />
        {!isLoggedIn && (
          <p className="text-center text-xl text-star-white mt-4">
            You&apos;ll need to <a href="/sign-in" className="text-nebula-teal underline">sign in</a> to save these settings.
          </p>
        )}
      </div>
    );
  }

  return null;
}
