// Each theme is a class on <html> with its own CSS variables in index.css. Until the user picks
// one, the app follows the OS setting (light or dark).
export const themes = ['light', 'dark'] as const
export type Theme = (typeof themes)[number]

export const themeStorageKey = 'inventory.theme'

// A theme saved before it was removed (e.g. "oxford") would leave <html> without styles.
export function dropUnknownTheme() {
  try {
    const saved = localStorage.getItem(themeStorageKey)
    if (saved && saved !== 'system' && !themes.includes(saved as Theme)) {
      localStorage.removeItem(themeStorageKey)
    }
  } catch {
    // Storage blocked: next-themes falls back to the OS setting.
  }
}
