'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { legalWalls, parseMove, pawnTargets, wallToString, cellToString } from '@pb/engine';
import type { Cell, Wall } from '@pb/engine';
import type { GameClient } from '@pb/protocol';
import { Board } from './Board';
import { MoveList } from './MoveList';
import { PlayerCard } from './PlayerCard';
import { useGame } from '@/lib/useGame';
import { useLibrary } from '@/lib/media-library';
import { ReactionPlayer } from './ReactionPlayer';
import { WinCelebration } from './WinCelebration';

export interface GameViewProps {
  create: () => GameClient;
  title: string;
  subtitle: string;
  /** Set for online games; shows the invite bar until an opponent arrives. */
  shareCode?: string;
}

/**
 * The invite strip above an online board.
 *
 * It states plainly which of the three situations you are in — waiting,
 * playing, or watching — because a room link that looks identical whether or
 * not anybody has joined is the main way an online game confuses people.
 */
function InviteBar({
  code,
  spectating,
  waiting,
  copied,
  onCopy,
}: {
  code: string;
  spectating: boolean;
  waiting: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel px-4 py-3">
      <span className="text-sm">
        {spectating
          ? "Watching this game."
          : waiting
            ? "Waiting for your opponent — send them this link."
            : "Your opponent is here. Good luck."}
      </span>
      <code className="rounded bg-panel-raised px-2 py-1 font-mono text-xs text-ink-dim">
        {code}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="ml-auto rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

const REASONS: Record<string, string> = {
  goal: 'reached the far side',
  resign: 'by resignation',
  timeout: 'on time',
  abandon: 'by abandonment',
  'ply-limit': 'on the move limit',
  elimination: 'last player standing',
  agreement: 'by agreement',
};

/**
 * A playable game, whatever is driving it.
 *
 * Everything here is expressed against `GameClient`, so this one component
 * serves hotseat, the computer, and later an online game.
 */
export function GameView({ create, title, subtitle, shareCode }: GameViewProps) {
  const { client, snapshot, state, error, moments } = useGame(create);
  const { library } = useLibrary();
  const [flipped, setFlipped] = useState(false);
  const [cinematic, setCinematic] = useState<number | null>(null);

  // A big moment stops the game and zooms in on whoever it happened to, so the
  // meme lands on the player it is about. The pause is the point: without it a
  // cutscene would quietly eat the next player's ten seconds, and the computer
  // would move behind it.
  useEffect(() => {
    const big = moments.items.find((m) => m.scale === 'takeover' && m.id !== 'game-won');
    if (!big) return;

    setCinematic(big.target ?? big.actor);
    client.send({ type: 'pause' });

    const timer = setTimeout(() => {
      setCinematic(null);
      client.send({ type: 'resume' });
    }, library.settings.cinematicMs);

    return () => {
      clearTimeout(timer);
      setCinematic(null);
      client.send({ type: 'resume' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moments.seq]);

  const [copied, setCopied] = useState(false);
  const mySeats = client.seats;
  const myTurn = !state.result && mySeats.includes(state.turn);

  const targets = useMemo<Cell[]>(
    () => (myTurn ? pawnTargets(state, state.turn) : []),
    [myTurn, state],
  );

  // Recomputed per position: every slot is tested against the no-trapping rule,
  // which is cheap enough here and means the board can only offer legal walls.
  const walls = useMemo<Wall[]>(() => (myTurn ? legalWalls(state) : []), [myTurn, state]);

  const lastMove = useMemo(() => {
    const last = snapshot.moves.at(-1);
    return last ? parseMove(last) : null;
  }, [snapshot.moves]);

  const basePerspective = mySeats[0] ?? 0;
  const perspective = flipped ? (basePerspective === 0 ? 1 : 0) : basePerspective;

  // The near seat is whoever sits at the bottom of the board, so flipping the
  // board swaps the cards with it.
  const nearSeat = perspective;
  const opponentSeats = [...snapshot.players.keys()].filter((seat) => seat !== nearSeat);

  // Online, a seat with nobody in it means the invite has not been taken up.
  const mySeat = mySeats[0] ?? 0;
  const waitingForOpponent =
    shareCode !== undefined && snapshot.players[mySeat === 0 ? 1 : 0] == null;

  const result = state.result;

  // Only a two-player game has one unambiguous loser to be punched; a
  // four-player win still gets the confetti.
  const celebration =
    result && result.winner !== null && state.variant.playerCount === 2
      ? { winner: result.winner, loser: result.winner === 0 ? 1 : 0 }
      : null;
  const outcomeFor = (seat: number): 'won' | 'lost' | 'drew' | null => {
    if (!result) return null;
    if (result.winner === null) return 'drew';
    return result.winner === seat ? 'won' : 'lost';
  };

  const resultText = result
    ? result.winner === null
      ? 'Draw'
      : `${snapshot.players[result.winner]?.name ?? `Player ${result.winner + 1}`} wins ${
          REASONS[result.reason] ?? ''
        }`
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-dim">{subtitle}</p>
        <Link href="/" className="ml-auto text-sm text-ink-dim hover:text-ink">
          Leave game
        </Link>
      </header>

      {shareCode ? (
        <InviteBar
          code={shareCode}
          spectating={mySeats.length === 0}
          waiting={waitingForOpponent}
          copied={copied}
          onCopy={() => {
            void navigator.clipboard?.writeText(window.location.href).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
          {/* Opponents above, you below, the way you would sit at the board. */}
          {opponentSeats.map((seat) => (
            <PlayerCard
              key={seat}
              seat={seat}
              player={snapshot.players[seat] ?? null}
              wallsLeft={state.wallsLeft[seat] ?? 0}
              wallsTotal={state.variant.wallsPerPlayer}
              toMove={!result && state.turn === seat}
              outcome={outcomeFor(seat)}
              clock={snapshot.clock}
              clockConfig={snapshot.clockConfig}
            />
          ))}

          <div className="relative">
            <Board
              state={state}
              targets={targets}
              walls={walls}
              lastMove={lastMove}
              perspective={perspective}
              interactive={myTurn && cinematic === null}
              celebration={celebration}
              focus={cinematic === null ? null : (state.pawns[cinematic] ?? null)}
              onPawnMove={(cell) => client.send({ type: 'move', move: cellToString(cell) })}
              onWallPlace={(wall) => client.send({ type: 'move', move: wallToString(wall) })}
            />

            <WinCelebration active={result?.winner != null} seat={result?.winner ?? 0} />

            {error ? (
              <p
                role="status"
                className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-panel-raised px-3 py-1.5 text-xs text-ink"
              >
                {error}
              </p>
            ) : null}
          </div>

            <PlayerCard
              key={nearSeat}
              seat={nearSeat}
              player={snapshot.players[nearSeat] ?? null}
              wallsLeft={state.wallsLeft[nearSeat] ?? 0}
              wallsTotal={state.variant.wallsPerPlayer}
              toMove={!result && state.turn === nearSeat}
              outcome={outcomeFor(nearSeat)}
              clock={snapshot.clock}
              clockConfig={snapshot.clockConfig}
            />
        </div>

        <aside className="flex flex-col gap-3">
          {resultText ? (
            <div className="rounded-lg border border-accent/40 bg-accent-soft/40 px-3 py-2.5 text-sm">
              {resultText}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFlipped((value) => !value)}
              className="rounded-md border border-edge bg-panel px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              Flip board
            </button>

            {result ? (
              <button
                type="button"
                onClick={() => client.send({ type: 'rematch' })}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface"
              >
                Play again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => client.send({ type: 'resign' })}
                className="rounded-md border border-edge bg-panel px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
              >
                Resign
              </button>
            )}
          </div>

          <MoveList moves={snapshot.moves} />

          <p className="text-xs leading-relaxed text-ink-faint">
            Click a highlighted square to move. Click a gap between squares to place a wall — only
            legal placements are offered.
          </p>
        </aside>
      </div>

      <ReactionPlayer
        library={library}
        moments={moments}
        seats={client.seats}
        clock={snapshot.clock}
        clockConfig={snapshot.clockConfig}
        turn={state.turn}
        live={!state.result}
      />
    </div>
  );
}
