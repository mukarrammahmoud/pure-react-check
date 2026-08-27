// Rule: no-ref-read-in-render
import { useRef } from 'react';

export function RefReadInRenderComp() {
  const myRef = useRef(10);
  const currentVal = myRef.current; // Read of ref.current in render body
  return <div>{currentVal}</div>;
}
