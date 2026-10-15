// "system" follows the OS setting (light or dark); each other theme is a class on <html> with its
// own CSS variables in index.css.
export const themes = ['system', 'light', 'dark', 'oxford'] as const

export const themeStorageKey = 'inventory.theme'
