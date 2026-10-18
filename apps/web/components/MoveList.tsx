'use client';

import { useEffect, useRef } from 'react';

/** Move history in engine notation, paired up into numbered turns. */
export function MoveList({ moves }: { moves: readonly string[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the list's own box, never `scrollIntoView`: that walks up every
    // scrollable ancestor and drags the whole page down to the move list after
    // each move, which on a phone means losing sight of the board. The box is a
    // fixed height for the same reason — a panel that grows as moves arrive
    // changes the page height and nudges the view on every turn.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [moves.length]);

  const rows: { number: number; first: string; second: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      first: moves[i]!,
      second: moves[i + 1] ?? null,
    });
  }

  return (
    <div className="rounded-lg border border-edge bg-panel">
      <div className="border-b border-edge px-3 py-2 text-xs font-medium tracking-wide text-ink-dim uppercase">
        Moves
      </div>
      <div ref={listRef} className="h-40 overflow-y-auto px-1 py-1 font-mono text-xs">
        {rows.length === 0 ? (
          <p className="px-2 py-3 font-sans text-ink-faint">No moves yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.number} className="flex gap-2 rounded px-2 py-1 hover:bg-panel-raised">
              <span className="w-6 shrink-0 text-right text-ink-faint">{row.number}.</span>
              <span className="w-14">{row.first}</span>
              <span className="w-14 text-ink-dim">{row.second ?? ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
