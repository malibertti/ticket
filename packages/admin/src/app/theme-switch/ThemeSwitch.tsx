import IconMoon from '../icons/IconMoon';
import IconSun from '../icons/IconSun';
import { useTheme } from './useTheme';

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <a
      href={`#`}
      className="contrast"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? <IconMoon /> : <IconSun />}
    </a>
  );
}
