'use client';

import { useState } from 'react';
import { LEVELS, createBotAgent } from '@pb/ai';
import { createGameClient } from '@pb/client';
import { GameView } from '@/components/GameView';
import { TEN_SECOND_TURNS } from '@/lib/clocks';

export default function ComputerGamePage() {
  const [level, setLevel] = useState<number | null>(null);
  // Bumped on every rematch-from-scratch so a fresh client is built.
  const [round, setRound] = useState(0);

  if (level === null) {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Play the computer</h1>
        <p className="mt-1 text-sm text-ink-dim">Pick a level. You can change it any time.</p>

        <div className="mt-5 grid gap-2">
          {LEVELS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLevel(option.id)}
              className="rounded-lg border border-edge bg-panel px-4 py-3 text-left transition-colors hover:border-accent/40"
            >
              <span className="block text-sm font-medium">{option.name}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Looks {option.depth} {option.depth === 1 ? 'move' : 'moves'} ahead
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const levelName = LEVELS.find((option) => option.id === level)?.name ?? `Level ${level}`;

  return (
    <div>
      <GameView
        key={`${level}-${round}`}
        create={() =>
          createGameClient(
            {
              mode: 'bot',
              level,
              levelName: `Computer (${levelName})`,
              clockConfig: TEN_SECOND_TURNS,
            },
            { createAgent: createBotAgent },
          )
        }
        title="Against the computer"
        subtitle={levelName}
      />
      <div className="mx-auto mt-4 w-full max-w-5xl">
        <button
          type="button"
          onClick={() => {
            setLevel(null);
            setRound((value) => value + 1);
          }}
          className="text-xs text-ink-faint transition-colors hover:text-ink"
        >
          Change level
        </button>
      </div>
    </div>
  );
}
