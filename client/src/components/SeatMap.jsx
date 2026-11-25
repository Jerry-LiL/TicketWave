import { money } from '../format';

function groupSeats(seats) {
  const sections = [];
  const byName = new Map();
  for (const seat of seats) {
    let section = byName.get(seat.section);
    if (!section) {
      section = { name: seat.section, rows: [] };
      byName.set(seat.section, section);
      sections.push(section);
    }
    let row = section.rows.find((item) => item.label === seat.row);
    if (!row) {
      row = { label: seat.row, seats: [] };
      section.rows.push(row);
    }
    row.seats.push(seat);
  }
  return sections;
}

export function SeatMap({ seats, selectedIds, onToggle, onRelease }) {
  const sections = groupSeats(seats);

  return (
    <div className="seatmap">
      <div className="stage">Stage</div>
      {sections.map((section) => (
        <section key={section.name} className="section-block">
          <h3>{section.name}</h3>
          {section.rows.map((row) => (
            <div className="seat-row" key={row.label}>
              <span className="row-label">{row.label}</span>
              {row.seats.map((seat) => {
                const label = `${seat.section} row ${seat.row} seat ${seat.number}, ${money(seat.priceCents)}`;
                if (seat.status === 'sold' || seat.status === 'held') {
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className={`seat is-${seat.status}`}
                      disabled
                      aria-label={`${label}, ${seat.status === 'sold' ? 'sold' : 'held'}`}
                    >
                      {seat.number}
                    </button>
                  );
                }
                if (seat.status === 'mine') {
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className="seat is-mine"
                      aria-label={`${label}, held by you`}
                      onClick={() => onRelease(seat)}
                    >
                      {seat.number}
                    </button>
                  );
                }
                const selected = selectedIds.has(seat.id);
                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={selected ? 'seat is-selected' : 'seat'}
                    aria-pressed={selected}
                    aria-label={label}
                    title={money(seat.priceCents)}
                    onClick={() => onToggle(seat)}
                  >
                    {seat.number}
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      ))}
      <ul className="legend">
        <li><i className="seat" /> Open</li>
        <li><i className="seat is-selected" /> Selected</li>
        <li><i className="seat is-mine" /> Your hold</li>
        <li><i className="seat is-held" /> Held</li>
        <li><i className="seat is-sold" /> Sold</li>
      </ul>
    </div>
  );
}
