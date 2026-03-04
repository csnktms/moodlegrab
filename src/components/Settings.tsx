import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { UserSettings } from '@/lib/moodle/types';
import { getSettings, saveSettings } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings({ [key]: value });
    if (key === 'theme') applyTheme(value as UserSettings['theme']);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Concurrent downloads */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Concurrent downloads</span>
        <input
          type="number"
          min={1}
          max={6}
          value={settings.concurrency}
          onChange={(e) => update('concurrency', Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
          className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        />
        <span className="text-[10px] text-gray-400">1–6 parallel downloads</span>
      </label>

      {/* Download as ZIP */}
      <label className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Download as ZIP</p>
          <p className="text-[10px] text-gray-400">Package files into a single archive</p>
        </div>
        <input
          type="checkbox"
          checked={settings.defaultAsZip}
          onChange={(e) => update('defaultAsZip', e.target.checked)}
          className="rounded"
        />
      </label>

      {/* ZIP name pattern */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">ZIP name pattern</span>
        <input
          type="text"
          value={settings.zipNamePattern}
          onChange={(e) => update('zipNamePattern', e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        />
        <span className="text-[10px] text-gray-400">
          {'Use {courseName} and {date} as placeholders'}
        </span>
      </label>

      {/* Max retries */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Max retries</span>
        <input
          type="number"
          min={0}
          max={5}
          value={settings.maxRetries}
          onChange={(e) => update('maxRetries', Math.min(5, Math.max(0, Number(e.target.value) || 0)))}
          className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        />
        <span className="text-[10px] text-gray-400">0–5 retry attempts per file</span>
      </label>

      {/* Theme */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Theme</legend>
        <div className="flex gap-3">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="theme"
                checked={settings.theme === t}
                onChange={() => update('theme', t)}
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

    </div>
  );
}
