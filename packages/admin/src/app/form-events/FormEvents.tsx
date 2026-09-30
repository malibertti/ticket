import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useAuth } from 'react-oidc-context';
import styles from './FormEvents.module.scss';
import { randomEvent } from './utils';

const { VITE_API_URL } = import.meta.env;

type CreateEventInput = {
  venueId: string;
  title: string;
  startsAt: string;
  onSaleAt: string;
  status: string;
};

export function FormEvents() {
  const auth = useAuth();
  const [event, setEvent] = useState<CreateEventInput>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    defaultValues: randomEvent('b32bd589-1634-4ec2-afd7-849a61c1e7b6'),
  });

  const onSubmit: SubmitHandler<CreateEventInput> = async (data) => {
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
        status: data.status,
      }),
    });
    const result = await response.json();

    if (response.ok) {
      setEvent(result);
      reset(randomEvent(data.venueId));
    } else {
      setError('root', {
        message: Array.isArray(result.message)
          ? result.message.join(', ')
          : result.message,
      });
    }
  };

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
              Venue ID
              <input
                placeholder="Venue ID"
                aria-invalid={!!errors.venueId || undefined}
                {...register('venueId', { required: 'Venue ID is required' })}
              />
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

            <label>
              Status
              <input
                aria-invalid={!!errors.status || undefined}
                {...register('status', { required: 'Status is required' })}
              />
              {errors.status && <small>{errors.status.message}</small>}
            </label>
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
