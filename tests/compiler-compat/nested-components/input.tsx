// Multiple components in one file — nested component test
import { useState } from 'react';

export function CleanParent() {
  return <div><CleanChild /></div>;
}

function CleanChild() {
  return <span>clean</span>;
}

// This one has a nested component definition — should be predicted-bailout
export function ParentWithNestedComponent() {
  const [count] = useState(0);

  function InlineChild() { // nested component definition
    return <span>inline</span>;
  }

  return <div><InlineChild />{count}</div>;
}
