import type { UserSettings, DownloadHistoryEntry } from './moodle/types';
import { DEFAULT_USER_SETTINGS } from './moodle/types';

const SETTINGS_KEY = 'moodlegrab-settings';
const HISTORY_KEY = 'moodlegrab-history';
const SYNC_STATE_KEY = 'moodlegrab-sync';

/**
 * Get user settings from chrome.storage.local, merged with defaults.
 */
export async function getSettings(): Promise<UserSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<UserSettings> | undefined;
  return { ...DEFAULT_USER_SETTINGS, ...stored };
}

/**
 * Save user settings to chrome.storage.local.
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({
    [SETTINGS_KEY]: { ...current, ...settings },
  });
}

/**
 * Get download history from chrome.storage.local.
 */
export async function getHistory(): Promise<DownloadHistoryEntry[]> {
  const result = await browser.storage.local.get(HISTORY_KEY);
  return (result[HISTORY_KEY] as DownloadHistoryEntry[]) ?? [];
}

/**
 * Add a download history entry.
 */
export async function addHistoryEntry(entry: DownloadHistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  // Keep last 100 entries
  if (history.length > 100) {
    history.length = 100;
  }
  await browser.storage.local.set({ [HISTORY_KEY]: history });
}

/**
 * Clear all download history.
 */
export async function clearHistory(): Promise<void> {
  await browser.storage.local.remove(HISTORY_KEY);
}

/** Stored sync state for a course (for incremental "what's new" feature) */
export interface CourseSyncState {
  courseId: string;
  lastScanTimestamp: number;
  /** Set of file URLs seen in the last scan */
  knownFileUrls: string[];
}

/**
 * Get the sync state for all courses.
 */
export async function getSyncStates(): Promise<Record<string, CourseSyncState>> {
  const result = await browser.storage.local.get(SYNC_STATE_KEY);
  return (result[SYNC_STATE_KEY] as Record<string, CourseSyncState>) ?? {};
}

/**
 * Save sync state for a course.
 */
export async function saveSyncState(courseId: string, state: CourseSyncState): Promise<void> {
  const states = await getSyncStates();
  states[courseId] = state;
  await browser.storage.local.set({ [SYNC_STATE_KEY]: states });
}
