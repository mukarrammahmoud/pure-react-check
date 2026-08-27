// Custom hook fixtures
import { useState } from 'react';

// Clean hook — should be "ready"
// NOTE: The increment function must return void, not set state directly in render body
export function useCounter(initial: number) {
  const [count, setCount] = useState(initial);
  // setState is called inside a returned callback — NOT during render
  const increment = () => { setCount((c) => c + 1); };
  return { count, increment };
}

// Hook with violation — should be "predicted-bailout"
export function useBrokenCounter() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // setState DIRECTLY in render (unconditional, not wrapped)
  return count;
}
