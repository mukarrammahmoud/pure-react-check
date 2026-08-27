import React, { useRef } from 'react';

export function RefOptionalChainComp() {
  const ref = useRef<HTMLDivElement>(null);
  const val = ref?.current; // Optional chain read in render

  return <div>{String(val)}</div>;
}
