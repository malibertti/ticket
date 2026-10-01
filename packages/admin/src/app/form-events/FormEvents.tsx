import type { CreateEventInput } from '@org/catalog-schema/schema';
import { Page } from '@org/catalog-schema/types';
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useAuth } from 'react-oidc-context';
import styles from './FormEvents.module.scss';
import { randomEvent } from './utils';

type Venue = {
  id: string;
  name: string;
  city: string;
};

const { VITE_API_URL } = import.meta.env;

export type EventFormValues = Omit<
  CreateEventInput,
  'startsAt' | 'onSaleAt'
> & {
  startsAt: string;
  onSaleAt: string;
};

export function FormEvents() {
  const auth = useAuth();
  const [event, setEvent] = useState<EventFormValues>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    defaultValues: randomEvent(),
  });

  const onSubmit: SubmitHandler<EventFormValues> = async (data) => {
    setEvent(undefined);

    const response = await fetch(`${VITE_API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.user?.access_token}`,
      },
      body: JSON.stringify({
        venueId: data.venueId,
        title: data.title,
        startsAt: new Date(data.startsAt).toISOString(),
        onSaleAt: new Date(data.onSaleAt).toISOString(),
      }),
    });
    const result = await response.json();

    if (response.ok) {
      setEvent(result);
      reset(randomEvent());
    } else {
      setError('root', {
        message: Array.isArray(result.message)
          ? result.message.join(', ')
          : result.message,
      });
    }
  };

  useEffect(() => {
    fetch(`${VITE_API_URL}/venues?limit=100`)
      .then((r) => r.json() as Promise<Page<Venue>>)
      .then((page) => setVenues(page.items));
  }, []);

  return (
    <>
      <section>
        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset>
            <label>
              Title
              <input
                placeholder="Event title"
                aria-invalid={!!errors.title || undefined}
                {...register('title', { required: 'Title is required' })}
              />
              {errors.title && <small>{errors.title.message}</small>}
            </label>
            <label>
              Venue
              <select
                aria-invalid={!!errors.venueId || undefined}
                {...register('venueId', { required: 'Venue is required' })}
              >
                <option value="" disabled>
                  Select a venue
                </option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.city}
                  </option>
                ))}
              </select>
              {errors.venueId && <small>{errors.venueId.message}</small>}
            </label>
            <div className={styles.formGroup}>
              <label>
                Starts at
                <input
                  type="datetime-local"
                  aria-invalid={!!errors.startsAt || undefined}
                  {...register('startsAt', {
                    required: 'Start time is required',
                  })}
                />
                {errors.startsAt && <small>{errors.startsAt.message}</small>}
              </label>
              <label>
                On sale at
                <input
                  type="datetime-local"
                  aria-invalid={!!errors.onSaleAt || undefined}
                  {...register('onSaleAt', {
                    required: 'On-sale time is required',
                  })}
                />
                {errors.onSaleAt && <small>{errors.onSaleAt.message}</small>}
              </label>
            </div>
          </fieldset>
          <button
            aria-busy={isSubmitting}
            type="submit"
            disabled={isSubmitting}
          >
            {!isSubmitting && 'Create event'}
          </button>
        </form>
        {errors.root && <small className="error">{errors.root.message}</small>}
      </section>
      {event && <pre>Created {JSON.stringify(event, null, 2)}</pre>}
    </>
  );
}
