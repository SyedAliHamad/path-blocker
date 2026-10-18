'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

// The media library lives at /admin and is reached by typing the URL. It is
// kept out of the nav because it is a tool for running the game, not something
// players should wander into — not as a security measure, since the route is
// public and the library it edits is the visitor’s own browser storage.
const NAV = [
  { href: '/', label: 'Play' },
  { href: '/rules', label: 'How to play' },
];

/**
 * Persistent chrome: a rail on desktop, a top bar on phones.
 *
 * Laid out as a sidebar from the start because that is where the lobby,
 * puzzles and leaderboard go; adding them later is adding list items.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The active link is decided after mount, never during the server render.
  // These pages are prerendered, so the shell is built once and shipped to
  // every route: marking a link active on the server would contradict the
  // client on whichever page actually matched, and React would throw the whole
  // tree away and rebuild it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex shrink-0 items-center gap-1 border-b border-edge bg-panel px-4 py-3 md:w-56 md:flex-col md:items-stretch md:gap-2 md:border-r md:border-b-0 md:py-5">
        <Link
          href="/"
          className="mr-4 flex items-center gap-2 text-base font-semibold tracking-tight md:mr-0 md:mb-4 md:px-2"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-surface"
          >
            P
          </span>
          <span>path blocker</span>
        </Link>

        <nav className="flex gap-1 md:flex-col" aria-label="Main">
          {NAV.map((item) => {
            const active = mounted && pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-panel-raised text-ink'
                    : 'text-ink-dim hover:bg-panel-raised hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
