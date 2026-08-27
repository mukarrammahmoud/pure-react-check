// Definite bailout: direct mutation of a local variable during render
import { useState } from 'react';

export function MutatesLocal() {
  const [count, setCount] = useState(0);
  let x = 0;
  x = 42; // mutation during render
  return <div>{x}</div>;
}
