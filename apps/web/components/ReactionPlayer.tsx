'use client';

import { useEffect, useRef, useState } from 'react';
import {
  orderedMoments,
  pickAsset,
  pickMusic,
  roleFor,
  type MediaAsset,
  type MediaLibrary,
  type Moment,
  type MomentRole,
} from '@pb/moments';
import { remainingFor, type ClockConfig, type ClockState } from '@pb/protocol';
import type { MomentBurst } from '@/lib/useGame';

/**
 * Stop a sound without clipping it.
 *
 * Meme audio is wildly inconsistent in length — a slow clap runs fifteen
 * seconds, a ding under one — so a reaction has to be cut off at the end of
 * its card rather than trusted to finish. Cutting dead sounds like a bug, so
 * it fades.
 */
/** How long after the blow the victim answers. */
const REPLY_DELAY = 300;

/** Most reaction sounds allowed to overlap before the oldest is let go. */
const MAX_CONCURRENT = 4;

/**
 * Endings whose sound is allowed to run to its natural end.
 *
 * Nothing follows them, so there is no reason to cut a fanfare short — and a
 * victory that fades out mid-phrase reads as a bug.
 */
const PLAY_IN_FULL: readonly string[] = ["game-won", "resign"];

function fadeOut(audio: HTMLAudioElement, ms = 260): void {
  const steps = 8;
  const step = audio.volume / steps;
  let done = 0;
  const timer = setInterval(() => {
    done += 1;
    audio.volume = Math.max(0, audio.volume - step);
    if (done >= steps) {
      clearInterval(timer);
      audio.pause();
    }
  }, ms / steps);
}

export interface ReactionPlayerProps {
  library: MediaLibrary;
  moments: MomentBurst;
  /** Seats the viewer controls, which decides whose reaction they see. */
  seats: readonly number[];
  clock: ClockState | null;
  clockConfig: ClockConfig | null;
  turn: number;
  live: boolean;
}

interface Showing {
  readonly key: number;
  readonly asset: MediaAsset;
  readonly moment: Moment;
}

/**
 * Plays the music and the reactions.
 *
 * Three rules keep it from becoming unbearable, all configurable in the admin
 * panel: a gap between any two reactions, a longer gap before the same
 * scenario repeats, and a hard cap per game. Without them a wall-heavy game
 * fires a gif every few seconds and nobody can see the board.
 */
export function ReactionPlayer({
  library,
  moments,
  seats,
  clock,
  clockConfig,
  turn,
  live,
}: ReactionPlayerProps) {
  const [showing, setShowing] = useState<Showing | null>(null);

  const lastFiredByActor = useRef(new Map<number, number>());
  const lastByScenario = useRef(new Map<string, number>());
  const lastAssetByScenario = useRef(new Map<string, string>());
  const firedThisGame = useRef(0);
  const music = useRef<HTMLAudioElement | null>(null);
  const pendingMusic = useRef<HTMLAudioElement | null>(null);
  const sfx = useRef<HTMLAudioElement[]>([]);
  const sfxTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lowWarned = useRef(-1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { settings } = library;

  useEffect(() => {
    const burst = moments.items;
    if (burst.length === 0) return;

    const opening = burst.find((m) => m.id === 'game-start' || m.id === 'rematch');
    if (opening) {
      for (const timer of sfxTimers.current) clearTimeout(timer);
      sfxTimers.current = [];
      for (const audio of sfx.current) fadeOut(audio);
      sfx.current = [];

      firedThisGame.current = 0;
      lastFiredByActor.current.clear();
      lastByScenario.current.clear();
      lastAssetByScenario.current.clear();

      const track = pickMusic(library);
      if (track?.soundUrl && !settings.muted) {
        music.current?.pause();
        pendingMusic.current = null;

        const audio = new Audio(track.soundUrl);
        audio.loop = true;
        audio.volume = settings.musicVolume;
        music.current = audio;

        void audio.play().catch(() => {
          // Browsers refuse audio until the page has been interacted with, and
          // arriving on a page is not an interaction. Rather than losing the
          // track, hold it and start it on the first click or keypress.
          pendingMusic.current = audio;
        });
      }
    }

    if (settings.muted) return;

    const now = Date.now();
    if (firedThisGame.current >= settings.maxPerGame) return;

    // Walk down from the most interesting moment. A scenario with nothing in
    // the library, or one that only just fired, lets a lesser one through
    // instead of swallowing the move entirely — which matters a lot while the
    // library is still half-filled.
    const assetKey = (id: string, role: MomentRole): string => id + ":" + role;

    let chosen: {
      moment: Moment;
      actor: MediaAsset | null;
      target: MediaAsset | null;
      localRole: MomentRole;
    } | null = null;

    for (const candidate of orderedMoments(burst)) {
      // Cooldowns are per player. Held globally they meant your own sound
      // silenced your opponent's reply — and a bot answers within 350-700ms,
      // so the computer was muted on nearly every move.
      const mine = lastFiredByActor.current.get(candidate.actor) ?? -Infinity;
      if (now - mine < settings.cooldownMs) continue;

      const scenarioKey = candidate.id + ":" + candidate.actor;
      const since = now - (lastByScenario.current.get(scenarioKey) ?? -Infinity);
      if (since < settings.perScenarioCooldownMs) continue;

      // Both sides of the moment, not just the viewer's. A block is an
      // exchange — someone lands it and someone wears it — and hearing only
      // half of that makes the game feel like it is reacting to one player.
      const actorAsset = pickAsset(
        library,
        candidate.id,
        "actor",
        Math.random,
        lastAssetByScenario.current.get(assetKey(candidate.id, "actor")),
      );
      const targetAsset =
        candidate.target === null
          ? null
          : pickAsset(
              library,
              candidate.id,
              "target",
              Math.random,
              lastAssetByScenario.current.get(assetKey(candidate.id, "target")),
            );

      if (actorAsset || targetAsset) {
        chosen = {
          moment: candidate,
          actor: actorAsset,
          target: targetAsset,
          localRole: roleFor(candidate, seats),
        };
        break;
      }
    }
    if (!chosen) return;

    const { moment, actor: actorAsset, target: targetAsset, localRole } = chosen;

    lastFiredByActor.current.set(moment.actor, now);
    lastByScenario.current.set(moment.id + ":" + moment.actor, now);
    if (actorAsset) lastAssetByScenario.current.set(assetKey(moment.id, "actor"), actorAsset.id);
    if (targetAsset) lastAssetByScenario.current.set(assetKey(moment.id, "target"), targetAsset.id);
    firedThisGame.current += 1;

    // Sounds are no longer cut off when the next moment arrives: two players
    // trading blows should overlap. Only the backlog is capped, so a fast
    // exchange stays an exchange rather than becoming a pile-up.
    sfx.current = sfx.current.filter((audio) => !audio.paused);
    while (sfx.current.length > MAX_CONCURRENT) {
      const oldest = sfx.current.shift();
      if (oldest) fadeOut(oldest);
    }

    const uncapped = PLAY_IN_FULL.includes(moment.id);

    const playReaction = (url: string, delay: number): void => {
      const begin = (): void => {
        try {
          const audio = new Audio(url);
          audio.volume = settings.volume;
          sfx.current.push(audio);
          void audio.play().catch(() => {});

          if (!uncapped) {
            sfxTimers.current.push(setTimeout(() => fadeOut(audio), settings.maxSoundMs));
          }
        } catch {
          // A dead URL should not interrupt the game.
        }
      };

      if (delay <= 0) begin();
      else sfxTimers.current.push(setTimeout(begin, delay));
    };

    if (actorAsset?.soundUrl) playReaction(actorAsset.soundUrl, 0);
    // The reply lands just after the blow, so the two read as call and
    // response rather than one muddled noise.
    if (targetAsset?.soundUrl) playReaction(targetAsset.soundUrl, REPLY_DELAY);

    const shown = (localRole === "target" ? targetAsset : actorAsset) ?? actorAsset ?? targetAsset;
    if (shown?.gifUrl) {
      setShowing({ key: moments.seq, asset: shown, moment });
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowing(null), settings.displayMs);
    }
    // Reacting to a new burst only; `library` and `seats` are read as they are
    // at that instant and should not re-fire a reaction on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moments.seq]);

  // Stop the music when the game ends or this view goes away.
  useEffect(() => {
    if (!live) {
      music.current?.pause();
      pendingMusic.current = null;
    }
  }, [live]);

  // Release a track that autoplay refused, as soon as the player touches
  // anything. Reaction sounds are not retried this way — a sting that arrives
  // several moves late is worse than one that never plays — but the music bed
  // is meant to run for the whole game, so it is worth starting late.
  useEffect(() => {
    const unlock = (): void => {
      const audio = pendingMusic.current;
      if (!audio) return;
      pendingMusic.current = null;
      void audio.play().catch(() => {});
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(
    () => () => {
      music.current?.pause();
      pendingMusic.current = null;
      for (const audio of sfx.current) audio.pause();
      for (const timer of sfxTimers.current) clearTimeout(timer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  // The clock warning is time-based rather than move-based, so it gets its own
  // low-frequency check rather than riding on the countdown's animation frame.
  useEffect(() => {
    if (!live || !clock || !clockConfig?.perMoveMs || settings.muted) return;

    const timer = setInterval(() => {
      const left = remainingFor(clock, turn, Date.now());
      if (left > 0 && left <= 3000 && lowWarned.current !== clock.asOf) {
        lowWarned.current = clock.asOf;
        const asset = pickAsset(library, 'clock-low', seats.includes(turn) ? 'actor' : 'target');
        if (asset?.soundUrl) {
          try {
            const audio = new Audio(asset.soundUrl);
            audio.volume = settings.volume;
            void audio.play().catch(() => {});
          } catch {
            // Ignore.
          }
        }
      }
    }, 400);

    return () => clearInterval(timer);
  }, [clock, clockConfig, library, live, seats, settings.muted, settings.volume, turn]);

  if (!showing?.asset.gifUrl) return null;

  const takeover = showing.moment.scale === 'takeover';
  const { magnitude } = showing.moment;

  return (
    <div
      aria-live="polite"
      className={
        takeover
          ? 'pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-surface/70'
          : 'pointer-events-none fixed right-4 bottom-4 z-50'
      }
    >
      <figure
        key={showing.key}
        className={`overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl ${
          takeover ? 'max-w-md' : 'w-48'
        }`}
      >
        <img
          src={showing.asset.gifUrl}
          alt={showing.asset.label || 'reaction'}
          className="block w-full object-cover"
        />
        {showing.asset.label || magnitude ? (
          <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-ink-dim">
            <span className="truncate">{showing.asset.label}</span>
            {magnitude ? <span className="text-accent tabular-nums">+{magnitude}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}
