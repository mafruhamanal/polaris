"use client";

import { type ReaderSettings, settingsToStyle } from "@/lib/settings";
import { type RoundOption, SAMPLE_TEXT } from "@/lib/quiz/questions";

type Props = {
  prompt: string;
  optionA: RoundOption;
  optionB: RoundOption;
  soFar: ReaderSettings;
  onPick: (option: RoundOption) => void;
};

export default function QuestionCard({ prompt, optionA, optionB, soFar, onPick }: Props) {
  const options = [optionA, optionB];

  return (
    <div className="space-y-8">
      <p className="text-4xl font-semibold text-center leading-snug">{prompt}</p>
      <div className="grid grid-cols-2 gap-6">
        {options.map((option) => {
          const style = settingsToStyle({ ...soFar, ...option.patch });
          return (
            <button
              key={option.id}
              onClick={() => onPick(option)}
              className="text-left rounded-2xl border-2 border-space-light hover:border-nebula-purple focus:border-nebula-teal focus:outline-none transition-all group bg-space-mid"
            >
              <div
                style={{ ...style, minHeight: "16rem" }}
                className="rounded-xl p-8 shadow-sm group-hover:shadow transition-shadow"
              >
                <p>{SAMPLE_TEXT}</p>
              </div>
              <p className="text-center text-xl text-star-dim mt-3 font-medium capitalize">{option.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
