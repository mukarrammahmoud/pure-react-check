// Definite bailout: setState called unconditionally in render body
import { useState } from 'react';

export function SetsStateInRender() {
  const [val, setVal] = useState(0);
  setVal(val + 1); // unconditional setState in render
  return <div>{val}</div>;
}
