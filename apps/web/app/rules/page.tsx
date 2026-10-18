import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to play',
  description: 'The rules of Path Blocker: moving, walls, jumping and how to win.',
};

const SECTIONS = [
  {
    heading: 'The board',
    body: 'A 9x9 grid. Each player starts on the middle square of their own back row with 10 walls in reserve. You start at the bottom and race to the top row; your opponent starts at the top and races to the bottom.',
  },
  {
    heading: 'Your turn',
    body: 'On your turn you either move your pawn one square or place a wall. You cannot pass. Players alternate until someone reaches the far side.',
  },
  {
    heading: 'Moving',
    body: 'Your pawn moves one square up, down, left or right — never diagonally, never through a wall, never off the board.',
  },
  {
    heading: 'Walls',
    body: 'Walls are two squares long and sit between cells, horizontally or vertically. A wall blocks both players. Walls cannot overlap or cross, and no wall may leave either player with no route to their goal at all — there is always a way through.',
  },
  {
    heading: 'Jumping',
    body: 'When the pawns are next to each other you jump straight over to the square behind. If a wall or the board edge sits directly behind your opponent, you step diagonally to either square beside them instead.',
  },
  {
    heading: 'Winning',
    body: 'First pawn to reach any square on the opposite side wins. You also win if your opponent resigns.',
  },
];

export default function RulesPage() {
  return (
    <article className="mx-auto w-full max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">How to play</h1>
      <p className="mt-2 text-ink-dim">
        Path Blocker is a race with obstacles. The rules fit on one page.
      </p>

      <div className="mt-7 space-y-6">
        {SECTIONS.map((section, index) => (
          <section key={section.heading}>
            <h2 className="flex items-baseline gap-2 text-base font-medium">
              <span className="text-sm text-accent tabular-nums">{index + 1}</span>
              {section.heading}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/play/computer"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface"
        >
          Play the computer
        </Link>
        <Link
          href="/play/local"
          className="rounded-md border border-edge bg-panel px-4 py-2 text-sm transition-colors hover:border-accent/40"
        >
          Local game
        </Link>
      </div>
    </article>
  );
}
