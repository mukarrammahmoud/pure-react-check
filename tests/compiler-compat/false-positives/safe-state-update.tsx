// False Positive Guard: Safe state updater inside event handler
import { useState } from 'react';

export function SafeStateUpdateComp() {
  const [count, setCount] = useState(0);

  const handleIncrement = () => {
    setCount((c) => c + 1); // Safe inside event handler
  };

  return <button onClick={handleIncrement}>{count}</button>;
}
