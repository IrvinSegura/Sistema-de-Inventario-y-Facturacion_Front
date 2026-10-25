/**
 * Each theme is a class on <html> with its own CSS variables in index.css. Until the user picks
 * one, the app is light, whatever the OS setting.
 */
export const themes = ['light', 'dark'] as const
export type Theme = (typeof themes)[number]

export const themeStorageKey = 'inventory.theme'

/**
 * Forgets a saved theme that no longer exists (e.g. "oxford", or "system" from when the app followed
 * the OS), which would leave <html> without styles.
 */
export function dropUnknownTheme() {
  try {
    const saved = localStorage.getItem(themeStorageKey)
    if (saved && !themes.includes(saved as Theme)) {
      localStorage.removeItem(themeStorageKey)
    }
  } catch {
    // Storage blocked: next-themes falls back to light.
  }
}
