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
    <div className="space-y-6">
      <p className="text-xl font-semibold text-center leading-snug">{prompt}</p>
      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => {
          const style = settingsToStyle({ ...soFar, ...option.patch });
          return (
            <button
              key={option.id}
              onClick={() => onPick(option)}
              className="text-left rounded-2xl border-2 border-transparent hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-all group"
            >
              <div
                style={{ ...style, minHeight: "10rem" }}
                className="rounded-xl p-5 shadow-sm group-hover:shadow transition-shadow"
              >
                <p>{SAMPLE_TEXT}</p>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2 font-medium capitalize">{option.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
