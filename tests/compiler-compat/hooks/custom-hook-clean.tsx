// Clean custom hook
import { useState } from 'react';

export function useCleanCustomHook(initial: number) {
  const [val, setVal] = useState(initial);
  const reset = () => setVal(0);
  return { val, reset };
}
