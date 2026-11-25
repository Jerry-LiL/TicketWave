import { useEffect, useState } from 'react';

export function useCountdown(iso) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!iso) return 0;
  return new Date(iso).getTime() - now;
}
