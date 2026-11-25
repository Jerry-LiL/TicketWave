const SHOW_TZ = 'America/Los_Angeles';

export function money(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function showDateParts(iso) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat('en-US', { timeZone: SHOW_TZ, month: 'short' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: SHOW_TZ, day: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: SHOW_TZ, weekday: 'short' }).format(date);
  return { month, day, weekday };
}

export function formatShowTime(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOW_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function countdownLabel(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
