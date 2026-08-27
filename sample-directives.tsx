// sample file to test "use no memo" / "use memo" directive detection

"use no memo"; // module-level opt-out → all components in this file are opted out

import { useState } from "react";

export function OptedOutButton({ label }: { label: string }) {
  // This component is in a file with a module-level "use no memo"
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      {label}: {count}
    </button>
  );
}

export function OptedOutCounter() {
  "use no memo"; // function-level opt-out (redundant here, but valid)
  const [n, setN] = useState(0);
  return <span onClick={() => setN((x) => x + 1)}>{n}</span>;
}

export function ForcedOptIn({ value }: { value: number }) {
  "use memo"; // force the compiler to optimise this one
  return <div>{value * 2}</div>;
}
