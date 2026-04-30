'use client';

export type ThemeName = 'light' | 'dark';

export function resolveThemeName(theme?: string | null): ThemeName | null {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return null;
}

export function getDomTheme(): ThemeName {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyThemeToRoot(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;

  try {
    window.localStorage.setItem('theme', theme);
  } catch {
    // Ignore storage errors so theme switching still works.
  }
}
