import { useState } from 'react';

const STORAGE_KEY = 'wasel-theme';

export function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // storage unavailable (private browsing) — theme still toggles for the session
    }
    setIsDark(next);
  };

  return { isDark, toggleTheme };
}
