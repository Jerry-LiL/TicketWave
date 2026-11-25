import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { formatShowTime, money } from '../format';

export function TicketsPage() {
  const location = useLocation();
  const freshBookingId = location.state?.freshBookingId;
  const bookings = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api('/api/bookings'),
  });

  if (bookings.isLoading) return <p className="status">Loading tickets…</p>;
  if (bookings.isError) return <p className="status error">{bookings.error.message}</p>;

  return (
    <div>
      <header className="page-head">
        <p className="kicker">Your wallet</p>
        <h1>Tickets</h1>
      </header>
      {freshBookingId ? <p className="banner">You are in. Show the QR code at the door.</p> : null}
      {bookings.data.bookings.length === 0 ? (
        <div className="panel">
          <p>No tickets yet.</p>
          <Link className="button" to="/">
            See shows
          </Link>
        </div>
      ) : (
        <div className="ticket-list">
          {bookings.data.bookings.map((booking) => (
            <article
              key={booking.id}
              className={booking.id === freshBookingId ? 'ticket-group is-fresh' : 'ticket-group'}
            >
              <header>
                <h2>{booking.event.title}</h2>
                <p className="meta">
                  {booking.event.artist} · {booking.event.venue}, {booking.event.city}
                </p>
                <p className="meta quiet">{formatShowTime(booking.event.startsAt)}</p>
                <p className="meta">{money(booking.totalCents)}</p>
              </header>
              <ul className="stubs">
                {booking.tickets.map((ticket) => (
                  <li key={ticket.code} className="stub">
                    <img src={ticket.qrDataUrl} alt={`QR code for ${ticket.section} row ${ticket.row} seat ${ticket.number}`} />
                    <div>
                      <p className="admit">Admit one</p>
                      <p>
                        {ticket.section} {ticket.row}
                        {ticket.number}
                      </p>
                      <p className="code">{ticket.code}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
