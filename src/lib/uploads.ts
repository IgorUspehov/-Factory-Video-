import type { MediaItem } from '../types';
import { readJSON, writeJSON } from './cache';

const KEY = 'fv_uploads';

/** Metadata of the user's own uploads for the "My uploads" library tab. */
export const uploadsStore = {
  list: (): MediaItem[] => readJSON<MediaItem[]>(KEY, []),
  add(items: MediaItem[]) {
    writeJSON(KEY, [...items, ...this.list()].slice(0, 60));
  },
  remove(id: string) {
    writeJSON(KEY, this.list().filter((i) => i.id !== id));
  },
};
