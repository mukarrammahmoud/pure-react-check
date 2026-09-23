import { useRef } from 'react';

export function LazyRefInitComponent() {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current = 'initialized';
  }
  return <div>{ref.current}</div>;
}
