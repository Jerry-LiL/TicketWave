import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { countdownLabel, formatShowTime, money } from '../format';
import { useCountdown } from '../useCountdown';

function soonestExpiry(seats) {
  return seats.reduce((soonest, seat) => {
    if (!seat.holdExpiresAt) return soonest;
    if (!soonest || seat.holdExpiresAt < soonest) return seat.holdExpiresAt;
    return soonest;
  }, null);
}

export function CheckoutPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api(`/api/events/${eventId}`),
  });
  const seatsQuery = useQuery({
    queryKey: ['seats', eventId],
    queryFn: () => api(`/api/events/${eventId}/seats`),
    refetchInterval: 4000,
  });

  const mine = (seatsQuery.data?.seats ?? []).filter((seat) => seat.status === 'mine');
  const expiresAt = soonestExpiry(mine);
  const remaining = useCountdown(expiresAt);
  const total = mine.reduce((sum, seat) => sum + seat.priceCents, 0);
  const seatIds = mine.map((seat) => seat.id);

  const checkout = useMutation({
    mutationFn: () => api('/api/checkout', { method: 'POST', body: { eventId, seatIds } }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/tickets', { state: { freshBookingId: data.booking.id } });
    },
    onError: (err) => {
      setError(err.message);
      queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
    },
  });

  const release = useMutation({
    mutationFn: () =>
      api(`/api/events/${eventId}/holds`, { method: 'DELETE', body: { seatIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
      navigate(`/events/${eventId}`);
    },
    onError: (err) => setError(err.message),
  });

  if (eventQuery.isLoading || seatsQuery.isLoading) return <p className="status">Loading checkout…</p>;
  if (eventQuery.isError) return <p className="status error">{eventQuery.error.message}</p>;

  const event = eventQuery.data.event;
  const expired = mine.length > 0 && remaining <= 0;

  return (
    <div className="checkout">
      <header className="page-head">
        <p className="kicker">Checkout</p>
        <h1>{event.title}</h1>
        <p className="meta">
          {event.venue}, {event.city} · {formatShowTime(event.startsAt)}
        </p>
      </header>

      {mine.length === 0 ? (
        <div className="panel">
          <p>You do not have seats on hold for this show.</p>
          <Link className="button" to={`/events/${eventId}`}>
            Back to seats
          </Link>
        </div>
      ) : (
        <div className="panel">
          <p className="timer" aria-live="polite">
            {expired ? 'This hold has expired.' : `Complete checkout in ${countdownLabel(remaining)}`}
          </p>
          <ul className="seat-list plain">
            {mine.map((seat) => (
              <li key={seat.id}>
                <span>
                  {seat.section} {seat.row}
                  {seat.number}
                </span>
                <span>{money(seat.priceCents)}</span>
              </li>
            ))}
          </ul>
          <p className="total">
            <span>Total</span>
            <span>{money(total)}</span>
          </p>
          <p className="quiet">
            Confirming places the order and sells these seats to you. There is no card charge in this build.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={expired || checkout.isPending || seatIds.length === 0}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? 'Confirming…' : 'Confirm booking'}
            </button>
            <button type="button" className="button button-quiet" onClick={() => release.mutate()} disabled={release.isPending}>
              Release seats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
