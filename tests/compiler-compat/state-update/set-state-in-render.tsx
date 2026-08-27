// Rule: no-set-state-in-render
import { useState } from 'react';

export function StateUpdateInRenderComp() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // Unconditional setState call in render
  return <div>{count}</div>;
}
