import { useEffect } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import usePrefersColorScheme from 'use-prefers-color-scheme';

type Theme = 'light' | 'dark' | undefined;

export function useTheme() {
  const systemPrefersColorScheme = usePrefersColorScheme();
  const [theme, setTheme] = useLocalStorageState<Theme>('theme', {
    defaultValue() {
      if (systemPrefersColorScheme !== 'no-preference') {
        return systemPrefersColorScheme;
      }
    },
  });

  const toggleTheme = () => {
    setTheme((theme) => (theme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return {
    theme,
    toggleTheme,
  };
}
