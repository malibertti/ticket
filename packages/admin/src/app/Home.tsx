import { useState } from 'react';
import { useAuth } from 'react-oidc-context';

const { VITE_API_URL } = import.meta.env;

export function Home() {
  const auth = useAuth();
  const groups = auth.user?.profile['cognito:groups'] as string[] | undefined;
  const isAdmin = groups?.includes('admins');
  const [data, setData] = useState<any>();
  console.log(auth);

  async function makeRequest(path: string, method = 'GET') {
    setData(null);
    await fetch(`${VITE_API_URL}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth.user?.access_token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        setData(data);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1em' }}>
        {isAdmin && (
          <>
            <button onClick={() => makeRequest('db/seed', 'post')}>
              Seed DB
            </button>
            <button onClick={() => makeRequest('db/truncate', 'post')}>
              Truncate DB
            </button>
          </>
        )}
        <button onClick={() => makeRequest('events')}>Get Events</button>
        <button onClick={() => makeRequest('venues')}>Get Venues</button>
      </div>
      <br />
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
