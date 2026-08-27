// False Positive Guard: Lazy ref initialization pattern
import { useRef } from 'react';

export function LazyRefInitComp() {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current = 'initialized'; // Supported lazy ref init pattern
  }
  return <div>{ref.current}</div>;
}
