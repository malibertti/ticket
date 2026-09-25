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
        setData(await res.json());
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async function searchEvents(value: string) {
    const query = value.trim();

    await makeRequest(
      `search/events${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1em' }}>
        {isAdmin && (
          <>
            <button onClick={() => makeRequest('db/truncate', 'post')}>
              Truncate DB
            </button>
            <button onClick={() => makeRequest('db/seed', 'post')}>
              Seed DB
            </button>
            <button onClick={() => makeRequest('search/reindex', 'post')}>
              Reindex
            </button>
          </>
        )}
        <button onClick={() => makeRequest('events')}>Get Events</button>
        <button onClick={() => makeRequest('venues')}>Get Venues</button>
      </div>
      <br />
      <div>
        <input
          type="text"
          placeholder="Search events"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void searchEvents(e.currentTarget.value);
          }}
        />
      </div>
      <br />
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
