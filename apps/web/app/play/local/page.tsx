'use client';

import { createGameClient } from '@pb/client';
import { GameView } from '@/components/GameView';
import { TEN_SECOND_TURNS } from '@/lib/clocks';

export default function LocalGamePage() {
  return (
    <GameView
      create={() => createGameClient({ mode: 'hotseat', clockConfig: TEN_SECOND_TURNS })}
      title="Local game"
      subtitle="Two players, one device · 10s a move"
    />
  );
}
