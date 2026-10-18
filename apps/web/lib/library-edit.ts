import type {
  LibrarySettings,
  MediaAsset,
  MediaCategory,
  MediaLibrary,
  MomentId,
  MomentRole,
} from '@pb/moments';
import { newId } from './media-library';

/**
 * Edits to the library, as pure functions returning a new library.
 *
 * The admin panel holds one library object and swaps it wholesale on every
 * change, which keeps saving to storage a single call in one place rather than
 * something each control has to remember to do.
 */
export function withSettings(
  library: MediaLibrary,
  patch: Partial<LibrarySettings>,
): MediaLibrary {
  return { ...library, settings: { ...library.settings, ...patch } };
}

export function withMusic(library: MediaLibrary, music: readonly MediaAsset[]): MediaLibrary {
  return { ...library, music };
}

export function withCategories(
  library: MediaLibrary,
  moment: MomentId,
  role: MomentRole,
  categories: readonly MediaCategory[],
): MediaLibrary {
  return {
    ...library,
    scenarios: {
      ...library.scenarios,
      [moment]: { ...library.scenarios[moment], [role]: categories },
    },
  };
}

export function blankAsset(): MediaAsset {
  return { id: newId(), label: '', gifUrl: null, soundUrl: null, weight: 1 };
}

export function blankCategory(name = 'New category'): MediaCategory {
  return { id: newId(), name, enabled: true, weight: 1, assets: [] };
}

/** Replace one asset inside one category, leaving the rest alone. */
export function replaceAsset(
  categories: readonly MediaCategory[],
  categoryId: string,
  asset: MediaAsset,
): MediaCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? {
          ...category,
          assets: category.assets.map((existing) => (existing.id === asset.id ? asset : existing)),
        }
      : category,
  );
}

export function removeAsset(
  categories: readonly MediaCategory[],
  categoryId: string,
  assetId: string,
): MediaCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? { ...category, assets: category.assets.filter((asset) => asset.id !== assetId) }
      : category,
  );
}

export function addAsset(
  categories: readonly MediaCategory[],
  categoryId: string,
): MediaCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? { ...category, assets: [...category.assets, blankAsset()] }
      : category,
  );
}

export function replaceCategory(
  categories: readonly MediaCategory[],
  category: MediaCategory,
): MediaCategory[] {
  return categories.map((existing) => (existing.id === category.id ? category : existing));
}
