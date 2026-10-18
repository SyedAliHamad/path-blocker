'use client';

import { useEffect, useRef } from 'react';

export interface WinCelebrationProps {
  active: boolean;
  /** Winning seat, so the colours lean towards whoever won. */
  seat: number;
}

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  colour: string;
  life: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  life: number;
  max: number;
}

const CONFETTI_UNTIL = 2600;
const FIREWORKS_UNTIL = 4600;
const BURST_EVERY = 520;

/**
 * Confetti and fireworks over the board.
 *
 * Canvas rather than SVG or DOM nodes: a few hundred particles redrawn every
 * frame is exactly what a canvas is for, and this way the celebration costs
 * the React tree nothing — it never re-renders while it runs.
 */
export function WinCelebration({ active, seat }: WinCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const palette = [
      getComputedStyle(document.documentElement).getPropertyValue(`--color-seat-${seat}`).trim() ||
        '#e2524a',
      '#f0a830',
      '#ffffff',
      '#52b788',
      '#4a90e2',
    ];
    const pick = (): string => palette[Math.floor(Math.random() * palette.length)] ?? '#fff';

    const confetti: Confetto[] = [];
    const sparks: Spark[] = [];

    let width = 0;
    let height = 0;
    const resize = (): void => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const burst = (): void => {
      const x = width * (0.2 + Math.random() * 0.6);
      const y = height * (0.15 + Math.random() * 0.35);
      const colour = pick();
      const count = 36 + Math.floor(Math.random() * 20);

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 60 + Math.random() * 140;
        const max = 700 + Math.random() * 500;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          colour,
          life: max,
          max,
        });
      }
    };

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let sinceBurst = BURST_EVERY;

    const tick = (now: number): void => {
      // Cap the step so a backgrounded tab does not resume with one huge jump.
      const dt = Math.min(48, now - last);
      last = now;
      elapsed += dt;
      const seconds = dt / 1000;

      if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
      context.clearRect(0, 0, width, height);

      if (elapsed < CONFETTI_UNTIL) {
        for (let i = 0; i < 3; i++) {
          confetti.push({
            x: Math.random() * width,
            y: -12,
            vx: (Math.random() - 0.5) * 60,
            vy: 60 + Math.random() * 120,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 8,
            w: 5 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            colour: pick(),
            life: 1,
          });
        }
      }

      sinceBurst += dt;
      if (elapsed < FIREWORKS_UNTIL && sinceBurst >= BURST_EVERY) {
        sinceBurst = 0;
        burst();
      }

      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]!;
        c.vy += 260 * seconds;
        c.vx *= 0.995;
        c.x += c.vx * seconds;
        c.y += c.vy * seconds;
        c.rot += c.vrot * seconds;

        if (c.y > height + 24) {
          confetti.splice(i, 1);
          continue;
        }

        context.save();
        context.translate(c.x, c.y);
        context.rotate(c.rot);
        context.fillStyle = c.colour;
        // Flatten as it spins, so the pieces read as paper rather than bricks.
        context.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.rot)));
        context.restore();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        s.vy += 120 * seconds;
        s.vx *= 0.97;
        s.vy *= 0.97;
        s.x += s.vx * seconds;
        s.y += s.vy * seconds;

        const fade = s.life / s.max;
        context.globalAlpha = fade;
        context.fillStyle = s.colour;
        context.beginPath();
        context.arc(s.x, s.y, 2.2 * fade + 0.6, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (confetti.length === 0 && sparks.length === 0 && elapsed > FIREWORKS_UNTIL) {
        context.clearRect(0, 0, width, height);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [active, seat]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
