import type { UserSettings } from './moodle/types';

/**
 * Apply the theme setting to the document root element.
 * Adds or removes the `dark` class on <html>.
 */
export function applyTheme(theme: UserSettings['theme']): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);

  document.documentElement.classList.toggle('dark', shouldBeDark);
}
