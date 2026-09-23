import { useRef } from 'react';

export function RefReadRenderComponent() {
  const countRef = useRef(0);
  const value = countRef.current;
  return <div>Ref value: {value}</div>;
}
