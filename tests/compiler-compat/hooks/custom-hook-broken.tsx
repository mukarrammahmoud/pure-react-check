// Broken custom hook
import { useState } from 'react';

export function useBrokenCustomHook() {
  const [val, setVal] = useState(0);
  setVal(val + 1); // Unconditional setState in hook body
  return val;
}
