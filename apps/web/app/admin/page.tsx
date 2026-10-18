'use client';

import { useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, catalogueByGroup, libraryStats, parseLibrary } from '@pb/moments';
import { useLibrary } from '@/lib/media-library';
import { blankAsset, withCategories, withMusic, withSettings } from '@/lib/library-edit';
import { AssetRow } from '@/components/admin/AssetRow';
import { CategoryPanel } from '@/components/admin/CategoryPanel';

const numberField =
  'w-20 rounded border border-edge bg-surface px-2 py-1 text-xs tabular-nums text-ink focus:border-accent/60 focus:outline-none';

/**
 * The media library editor.
 *
 * Everything lives in this browser's storage, so there is nothing to protect
 * with a login yet — when the library moves to the game server, this page is
 * the thing that needs auth in front of it.
 */
export default function AdminPage() {
  const { library, ready, update } = useLibrary();
  const [openGroup, setOpenGroup] = useState<string | null>('Wall drama');
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => libraryStats(library), [library]);
  const groups = useMemo(() => catalogueByGroup(), []);

  const exportLibrary = (): void => {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'path-blocker-media.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Replace the library with the bundled starter set.
   *
   * Every sound in it was loaded and timed against the running app, so this is
   * a working library rather than a list of plausible URLs. It is meme audio
   * from a soundboard — fine for building and testing, to be swapped for
   * licensed equivalents before this goes public. See docs/sound-research.md.
   */
  const loadStarter = async (): Promise<void> => {
    try {
      const response = await fetch('/starter-library.json');
      if (!response.ok) throw new Error(String(response.status));
      update(parseLibrary(await response.json()));
      setNote('Starter library loaded — this replaced what was here.');
    } catch {
      setNote('Could not load the starter library.');
    }
  };

  const importLibrary = async (file: File): Promise<void> => {
    try {
      update(parseLibrary(JSON.parse(await file.text())));
      setNote(`Imported ${file.name}`);
    } catch {
      setNote('That file was not a library I could read.');
    }
  };

  if (!ready) {
    return <p className="text-sm text-ink-dim">Loading library…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Media library</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Paste GIF and sound URLs against the moments they should fire on. Stored in this browser —
          use Export to move it elsewhere.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-edge bg-panel px-2 py-1 text-ink-dim">
            {stats.assets} assets · {stats.categories} categories · {stats.scenariosCovered}/23
            scenarios covered
          </span>
          <button
            type="button"
            onClick={exportLibrary}
            className="rounded border border-edge bg-panel px-2 py-1 text-ink-dim hover:text-ink"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded border border-edge bg-panel px-2 py-1 text-ink-dim hover:text-ink"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => void loadStarter()}
            className="rounded border border-accent/40 bg-accent-soft px-2 py-1 text-accent"
          >
            Load starter library
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importLibrary(file);
              e.target.value = '';
            }}
          />
          {note ? <span className="text-ink-faint">{note}</span> : null}
        </div>
      </header>

      <section className="mb-6 rounded-lg border border-edge bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Playback</h2>
          <button
            type="button"
            onClick={() => {
              update(withSettings(library, DEFAULT_SETTINGS));
              setNote('Playback settings reset. Your assets were left alone.');
            }}
            className="rounded border border-edge px-2 py-1 text-xs text-ink-dim hover:text-ink"
          >
            Reset to defaults
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4 text-xs text-ink-dim">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={library.settings.muted}
              onChange={(e) => update(withSettings(library, { muted: e.target.checked }))}
            />
            Mute everything
          </label>
          <label className="flex flex-col gap-1">
            Sound volume
            <input
              className={numberField}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={library.settings.volume}
              onChange={(e) => update(withSettings(library, { volume: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            Music volume
            <input
              className={numberField}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={library.settings.musicVolume}
              onChange={(e) =>
                update(withSettings(library, { musicVolume: Number(e.target.value) }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Max per game
            <input
              className={numberField}
              type="number"
              min={0}
              value={library.settings.maxPerGame}
              onChange={(e) =>
                update(withSettings(library, { maxPerGame: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Cooldown (ms)
            <input
              className={numberField}
              type="number"
              min={0}
              step={500}
              value={library.settings.cooldownMs}
              onChange={(e) =>
                update(withSettings(library, { cooldownMs: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Same scenario (ms)
            <input
              className={numberField}
              type="number"
              min={0}
              step={1000}
              value={library.settings.perScenarioCooldownMs}
              onChange={(e) =>
                update(
                  withSettings(library, { perScenarioCooldownMs: Number(e.target.value) || 0 }),
                )
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Sound cap (ms)
            <input
              className={numberField}
              type="number"
              min={500}
              step={500}
              value={library.settings.maxSoundMs}
              onChange={(e) =>
                update(withSettings(library, { maxSoundMs: Number(e.target.value) || 1000 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Big moment (ms)
            <input
              className={numberField}
              type="number"
              min={0}
              step={200}
              value={library.settings.cinematicMs}
              onChange={(e) =>
                update(withSettings(library, { cinematicMs: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            On screen (ms)
            <input
              className={numberField}
              type="number"
              min={500}
              step={200}
              value={library.settings.displayMs}
              onChange={(e) =>
                update(withSettings(library, { displayMs: Number(e.target.value) || 2000 }))
              }
            />
          </label>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-edge bg-panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Game music</h2>
            <p className="text-xs text-ink-faint">
              One is picked at random per game. Browsers block audio until the page is clicked, so
              it starts on the first interaction.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update(withMusic(library, [...library.music, blankAsset()]))}
            className="rounded border border-edge px-2 py-1 text-xs text-ink-dim hover:text-ink"
          >
            + Track
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {library.music.length === 0 ? (
            <p className="text-xs text-ink-faint">No music yet.</p>
          ) : (
            library.music.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                onChange={(next) =>
                  update(
                    withMusic(
                      library,
                      library.music.map((existing) => (existing.id === next.id ? next : existing)),
                    ),
                  )
                }
                onRemove={() =>
                  update(
                    withMusic(
                      library,
                      library.music.filter((existing) => existing.id !== asset.id),
                    ),
                  )
                }
                onSave={() => update(library)}
              />
            ))
          )}
        </div>
      </section>

      {groups.map((group) => {
        const open = openGroup === group.group;
        return (
          <section
            key={group.group}
            className={`mb-3 rounded-xl transition-colors ${
              open ? "border border-accent/30 bg-accent-soft/20 p-2" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenGroup(open ? null : group.group)}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors ${
                open ? "border-accent/40 bg-panel-raised" : "border-edge bg-panel"
              }`}
            >
              <span className={`text-sm font-medium ${open ? "text-accent" : ""}`}>
                {group.group}
              </span>
              <span className="text-xs text-ink-faint">
                {group.moments.length} scenarios {open ? '▾' : '▸'}
              </span>
            </button>

            {open ? (
              <div className="mt-2 flex flex-col gap-3">
                {group.moments.map((info) => (
                  <article key={info.id} className="rounded-lg border border-edge bg-panel/60 p-3">
                    <div className="mb-2">
                      <h3 className="flex items-baseline gap-2 text-sm font-medium">
                        {info.name}
                        {info.scale === 'takeover' ? (
                          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
                            full screen
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-faint">{info.description}</p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <CategoryPanel
                        title={info.actorLabel}
                        categories={library.scenarios[info.id].actor}
                        onChange={(categories) =>
                          update(withCategories(library, info.id, 'actor', categories))
                        }
                        onSave={() => update(library)}
                      />
                      {info.targetLabel ? (
                        <CategoryPanel
                          title={info.targetLabel}
                          categories={library.scenarios[info.id].target}
                          onChange={(categories) =>
                            update(withCategories(library, info.id, 'target', categories))
                          }
                          onSave={() => update(library)}
                        />
                      ) : (
                        <p className="self-center text-xs text-ink-faint">
                          This moment has only one side.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
