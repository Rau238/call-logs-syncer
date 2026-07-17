import { useEffect, useState } from 'react';

/** Avoid flashing skeletons on fast loads — only true after `delayMs`. */
export function useDelayedTrue(value: boolean, delayMs = 280): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!value) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return delayed;
}
