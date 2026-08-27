// False-positive guard: lazy ref initialization should NOT be flagged
import { useRef } from 'react';

export function LazyRefInit() {
  const playerRef = useRef<{ play: () => void } | null>(null);
  // This is the standard lazy-init pattern — should NOT trigger no-ref-read-in-render
  if (playerRef.current === null) {
    playerRef.current = { play: () => {} };
  }
  return <div>ok</div>;
}

// False-positive guard: ref read inside useEffect is valid
export function RefInEffect() {
  const ref = useRef(0);
  // Reading in useEffect is NOT a render-phase read
  return <div onClick={() => console.log(ref.current)}>ok</div>;
}

// False-positive guard: ref read inside event handler is valid
export function RefInHandler() {
  const ref = useRef(0);
  const handle = () => {
    console.log(ref.current); // inside event handler, not render
  };
  return <button onClick={handle}>ok</button>;
}
