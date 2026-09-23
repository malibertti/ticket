import { useAuth } from 'react-oidc-context';
import { Link, Route, Routes } from 'react-router-dom';
import styles from './app.module.scss';
import { FormEvents } from './form-events/FormEvents';
import { Home } from './Home';
import { Nav } from './nav/nav';

export function App() {
  const auth = useAuth();

  console.log(auth);

  if (auth.isLoading) {
    return <pre>LOADING...</pre>;
  }

  if (auth.error) {
    return <pre>Auth error: {auth.error.message}</pre>;
  }

  if (!auth.isAuthenticated) {
    return <button onClick={() => void auth.signinRedirect()}>Login</button>;
  }

  return (
    <div className={styles.host}>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events/new" element={<FormEvents />} />
        <Route
          path="/page-2"
          element={
            <div>
              <Link to="/">Click here to go back to root page.</Link>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
