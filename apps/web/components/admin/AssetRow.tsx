'use client';

import { useState } from 'react';
import type { MediaAsset } from '@pb/moments';

export interface AssetRowProps {
  asset: MediaAsset;
  onChange: (asset: MediaAsset) => void;
  onRemove: () => void;
  /** Re-persists the library and confirms it, for peace of mind. */
  onSave: () => void;
}

const field =
  'w-full rounded border border-edge bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none';

/**
 * One gif-and-sound pair.
 *
 * The preview is the point of this row: a pasted URL is either a working gif
 * or a typo, and there is no way to tell the two apart from the text.
 */
export function AssetRow({ asset, onChange, onRemove, onSave }: AssetRowProps) {
  const [showing, setShowing] = useState(false);
  const [saved, setSaved] = useState(false);

  const play = (): void => {
    setShowing((value) => !value);
    if (!asset.soundUrl) return;
    try {
      const audio = new Audio(asset.soundUrl);
      audio.volume = 0.7;
      void audio.play().catch(() => {});
    } catch {
      // A bad URL should not take the panel down.
    }
  };

  return (
    <div className="rounded border border-edge/70 bg-panel-raised p-2">
      <div className="grid gap-1.5 2xl:grid-cols-[1fr_1.6fr_1.6fr_auto]">
        <input
          className={field}
          value={asset.label}
          placeholder="Label"
          onChange={(e) => onChange({ ...asset, label: e.target.value })}
        />
        <input
          className={field}
          value={asset.gifUrl ?? ''}
          placeholder="GIF or image URL"
          onChange={(e) => onChange({ ...asset, gifUrl: e.target.value || null })}
        />
        <input
          className={field}
          value={asset.soundUrl ?? ''}
          placeholder="Sound URL (mp3/ogg)"
          onChange={(e) => onChange({ ...asset, soundUrl: e.target.value || null })}
        />
        <div className="flex items-center gap-1">
          <input
            className="w-12 rounded border border-edge bg-surface px-1.5 py-1 text-center text-xs tabular-nums"
            type="number"
            min={0}
            step={1}
            value={asset.weight}
            title="Weight"
            onChange={(e) => onChange({ ...asset, weight: Number(e.target.value) || 0 })}
          />
          <button
            type="button"
            onClick={() => {
              onSave();
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1600);
            }}
            className={`rounded border px-2 py-1 text-xs transition-colors ${
              saved
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-edge text-ink-dim hover:text-ink"
            }`}
          >
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={play}
            className="rounded border border-edge px-2 py-1 text-xs text-ink-dim hover:text-ink"
          >
            Test
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-edge px-2 py-1 text-xs text-ink-faint hover:text-seat-0"
            aria-label="Remove asset"
          >
            &times;
          </button>
        </div>
      </div>

      {showing && asset.gifUrl ? (
        <img
          src={asset.gifUrl}
          alt={asset.label || 'preview'}
          className="mt-2 max-h-40 rounded border border-edge"
        />
      ) : null}
    </div>
  );
}
