import { useAuth } from 'react-oidc-context';
import { Link } from 'react-router-dom';
import { ThemeSwitch } from '../theme-switch/ThemeSwitch';
import styles from './nav.module.scss';

const { VITE_COGNITO_DOMAIN, VITE_COGNITO_CLIENT_ID } = import.meta.env;

export function Nav() {
  const auth = useAuth();

  async function logout() {
    await auth.removeUser();
    const logoutUri = encodeURIComponent(`${window.location.origin}/`);
    window.location.assign(
      `${VITE_COGNITO_DOMAIN}/logout?client_id=${VITE_COGNITO_CLIENT_ID}&logout_uri=${logoutUri}`,
    );
  }

  return (
    <nav className={styles.host}>
      <ul className={styles.links}>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/page-2">Page 2</Link>
        </li>
      </ul>
      <ul className={styles.actions}>
        <li>{auth.user?.profile.email}</li>
        <li>
          <ThemeSwitch />
        </li>
        <li>
          <a href="#" onClick={logout}>
            Logout
          </a>
        </li>
      </ul>
    </nav>
  );
}
