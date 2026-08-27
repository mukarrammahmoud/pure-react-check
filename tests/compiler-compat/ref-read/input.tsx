// Definite bailout: reads ref.current during the render phase
import { useRef } from 'react';

export function ReadsRefInRender() {
  const countRef = useRef(0);
  const value = countRef.current; // read during render
  return <div>{value}</div>;
}
