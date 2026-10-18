import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Path Blocker — Online Strategy Board Game',
    template: '%s — Path Blocker',
  },
  description:
    'Race your pawn across the board and wall off your opponent. Free to play in your browser, against a friend or the computer.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
