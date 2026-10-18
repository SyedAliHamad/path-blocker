'use client';

import type { MediaCategory } from '@pb/moments';
import { AssetRow } from './AssetRow';
import { addAsset, blankCategory, removeAsset, replaceAsset, replaceCategory } from '@/lib/library-edit';

export interface CategoryPanelProps {
  title: string;
  categories: readonly MediaCategory[];
  onChange: (categories: readonly MediaCategory[]) => void;
  onSave: () => void;
}

/**
 * One side of a scenario: the categories of media for either the player who
 * caused it or the one it happened to.
 *
 * Categories exist so a pool of fifty reaction gifs does not drown out a
 * handful of good ones — selection picks a category first, then an asset
 * inside it.
 */
export function CategoryPanel({ title, categories, onChange, onSave }: CategoryPanelProps) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-ink-dim uppercase">{title}</h4>
        <button
          type="button"
          onClick={() => onChange([...categories, blankCategory()])}
          className="rounded border border-edge px-2 py-1 text-xs text-ink-dim hover:text-ink"
        >
          + Category
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="py-2 text-xs text-ink-faint">Nothing here yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((category) => (
            <div key={category.id} className="rounded border border-edge/70 p-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-xs"
                  value={category.name}
                  placeholder="Category name"
                  onChange={(e) =>
                    onChange(replaceCategory(categories, { ...category, name: e.target.value }))
                  }
                />
                <label className="flex items-center gap-1 text-xs text-ink-faint">
                  <input
                    type="checkbox"
                    checked={category.enabled}
                    onChange={(e) =>
                      onChange(
                        replaceCategory(categories, { ...category, enabled: e.target.checked }),
                      )
                    }
                  />
                  On
                </label>
                <input
                  className="w-12 rounded border border-edge bg-surface px-1.5 py-1 text-center text-xs tabular-nums"
                  type="number"
                  min={0}
                  value={category.weight}
                  title="Category weight"
                  onChange={(e) =>
                    onChange(
                      replaceCategory(categories, {
                        ...category,
                        weight: Number(e.target.value) || 0,
                      }),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => onChange(categories.filter((c) => c.id !== category.id))}
                  className="rounded border border-edge px-2 py-1 text-xs text-ink-faint hover:text-seat-0"
                >
                  Delete
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {category.assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onChange={(next) => onChange(replaceAsset(categories, category.id, next))}
                    onRemove={() => onChange(removeAsset(categories, category.id, asset.id))}
                    onSave={onSave}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onChange(addAsset(categories, category.id))}
                  className="self-start rounded border border-dashed border-edge px-2 py-1 text-xs text-ink-faint hover:text-ink"
                >
                  + Asset
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
