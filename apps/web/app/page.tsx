import Link from 'next/link';
import { PlayWithFriends } from '@/components/PlayWithFriends';

const MODES = [
  {
    href: '/play/computer',
    title: 'Play the computer',
    detail: 'Four difficulty levels',
  },
  {
    href: '/play/local',
    title: 'Local game',
    detail: 'Two players, one device',
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-xl border border-edge bg-panel p-6 md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Play <span className="text-accent">Path Blocker</span>
        </h1>
        <p className="mt-2 max-w-prose text-ink-dim">
          Race your pawn across the board and wall off your opponent — just do not shut yourself
          in. Free, in your browser, no account needed.
        </p>

        <Link
          href="/play/quick"
          className="mt-6 flex items-center justify-between gap-4 rounded-lg bg-accent px-5 py-4 text-surface transition-opacity hover:opacity-90"
        >
          <span>
            <span className="block text-base font-semibold">Play now</span>
            <span className="mt-0.5 block text-xs opacity-80">
              Matched with a random opponent — no account needed
            </span>
          </span>
          <span aria-hidden className="text-xl">&rarr;</span>
        </Link>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PlayWithFriends />
          {MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className="rounded-lg border border-edge bg-panel-raised px-4 py-3.5 transition-colors hover:border-accent/40"
            >
              <span className="block text-sm font-medium">{mode.title}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">{mode.detail}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/rules"
          className="mt-5 inline-block text-sm text-accent hover:underline"
        >
          New here? Learn the rules →
        </Link>
      </section>
    </div>
  );
}
