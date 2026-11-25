import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../api';
import { SeatMap } from '../components/SeatMap';
import { countdownLabel, formatShowTime, money } from '../format';
import { useCountdown } from '../useCountdown';

const MAX_SEATS = 6;

function soonestExpiry(seats) {
  return seats.reduce((soonest, seat) => {
    if (!seat.holdExpiresAt) return soonest;
    if (!soonest || seat.holdExpiresAt < soonest) return seat.holdExpiresAt;
    return soonest;
  }, null);
}

export function EventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(() => new Set());
  const [formError, setFormError] = useState('');

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api(`/api/events/${eventId}`),
  });

  const seatsQuery = useQuery({
    queryKey: ['seats', eventId],
    queryFn: () => api(`/api/events/${eventId}/seats`),
    refetchInterval: 5000,
  });

  const seats = seatsQuery.data?.seats ?? [];
  const mine = seats.filter((seat) => seat.status === 'mine');
  const selectedSeats = seats.filter((seat) => selected.has(seat.id));
  const expiresAt = soonestExpiry(mine);
  const remaining = useCountdown(expiresAt);

  useEffect(() => {
    const list = seatsQuery.data?.seats;
    if (!list) return;
    const available = new Set(
      list.filter((seat) => seat.status === 'available').map((seat) => seat.id)
    );
    setSelected((current) => {
      let changed = false;
      const next = new Set();
      for (const id of current) {
        if (available.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [seatsQuery.data]);

  const hold = useMutation({
    mutationFn: (seatIds) =>
      api(`/api/events/${eventId}/holds`, { method: 'POST', body: { seatIds } }),
    onSuccess: async () => {
      setSelected(new Set());
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
    },
    onError: (error) => {
      if (error.status === 401) {
        navigate('/login', { state: { from: `/events/${eventId}` } });
        return;
      }
      setFormError(error.message);
      queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
    },
  });

  const release = useMutation({
    mutationFn: (seatIds) =>
      api(`/api/events/${eventId}/holds`, { method: 'DELETE', body: { seatIds } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seats', eventId] }),
    onError: (error) => setFormError(error.message),
  });

  function onToggle(seat) {
    setFormError('');
    if (!selected.has(seat.id) && selected.size + mine.length >= MAX_SEATS) {
      setFormError('You can hold up to 6 seats for a show.');
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  }

  function onHold() {
    if (!getToken()) {
      navigate('/login', { state: { from: `/events/${eventId}` } });
      return;
    }
    hold.mutate(selectedSeats.map((seat) => seat.id));
  }

  if (eventQuery.isLoading || seatsQuery.isLoading) return <p className="status">Loading the room…</p>;
  if (eventQuery.isError) return <p className="status error">{eventQuery.error.message}</p>;
  if (seatsQuery.isError) return <p className="status error">{seatsQuery.error.message}</p>;

  const event = eventQuery.data.event;
  const selectedTotal = selectedSeats.reduce((sum, seat) => sum + seat.priceCents, 0);

  return (
    <div className="event-layout">
      <div>
        <p className="kicker">{event.city}</p>
        <h1>{event.title}</h1>
        <p className="meta">
          {event.artist} · {event.venue}
        </p>
        <p className="meta quiet">{formatShowTime(event.startsAt)}</p>
        <p className="lede">{event.description}</p>
        <SeatMap
          seats={seats}
          selectedIds={selected}
          onToggle={onToggle}
          onRelease={(seat) => release.mutate([seat.id])}
        />
      </div>
      <aside className="basket">
        <h2>Your seats</h2>
        {mine.length === 0 && selectedSeats.length === 0 ? (
          <p className="quiet">Select open seats. A hold lasts until the timer runs out.</p>
        ) : null}
        {mine.length > 0 ? (
          <div>
            <p className="timer" aria-live="polite">
              {remaining > 0 ? `Held for ${countdownLabel(remaining)}` : 'Hold expired'}
            </p>
            <ul className="seat-list">
              {mine.map((seat) => (
                <li key={seat.id}>
                  <span>
                    {seat.section} {seat.row}
                    {seat.number}
                  </span>
                  <span>{money(seat.priceCents)}</span>
                  <button type="button" className="text-button" onClick={() => release.mutate([seat.id])}>
                    Release
                  </button>
                </li>
              ))}
            </ul>
            <Link className="button" to={`/checkout/${eventId}`}>
              Checkout
            </Link>
          </div>
        ) : null}
        {selectedSeats.length > 0 ? (
          <div className="stack">
            <ul className="seat-list">
              {selectedSeats.map((seat) => (
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
              <span>Selected</span>
              <span>{money(selectedTotal)}</span>
            </p>
            <button type="button" className="button" onClick={onHold} disabled={hold.isPending}>
              {hold.isPending ? 'Holding…' : `Hold ${selectedSeats.length} ${selectedSeats.length === 1 ? 'seat' : 'seats'}`}
            </button>
          </div>
        ) : null}
        {formError ? <p className="error">{formError}</p> : null}
      </aside>
    </div>
  );
}
