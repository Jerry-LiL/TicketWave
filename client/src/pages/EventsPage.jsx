import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatShowTime, money, showDateParts } from '../format';

export function EventsPage() {
  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api('/api/events'),
  });

  if (events.isLoading) return <p className="status">Loading shows…</p>;
  if (events.isError) return <p className="status error">{events.error.message}</p>;

  return (
    <div>
      <header className="page-head">
        <p className="kicker">Bay Area rooms</p>
        <h1>Shows on sale</h1>
        <p className="lede">
          Pick a seat and hold it while you check out. Holds expire on their own, and the seat goes back on sale.
        </p>
      </header>
      {events.data.events.length === 0 ? (
        <p className="status">Nothing is on sale right now.</p>
      ) : (
        <ul className="bill">
          {events.data.events.map((event) => {
            const when = showDateParts(event.startsAt);
            return (
              <li key={event.id}>
                <Link to={`/events/${event.id}`}>
                  <div className="date-block">
                    <span>{when.weekday}</span>
                    <strong>{when.month} {when.day}</strong>
                  </div>
                  <div>
                    <h2>{event.title}</h2>
                    <p className="meta">
                      {event.artist} · {event.venue}, {event.city}
                    </p>
                    <p className="meta quiet">{formatShowTime(event.startsAt)}</p>
                  </div>
                  <div className="bill-side">
                    <span>{event.minPriceCents == null ? '—' : `From ${money(event.minPriceCents)}`}</span>
                    <span className="quiet">
                      {event.availableCount === 0 ? 'Sold out' : `${event.availableCount} open`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
