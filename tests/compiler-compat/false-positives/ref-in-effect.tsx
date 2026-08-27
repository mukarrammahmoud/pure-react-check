// False Positive Guard: Ref read/mutation inside useEffect
import { useRef, useEffect } from 'react';

export function RefInEffectComp() {
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current += 1; // Safe inside effect
    console.log(countRef.current);
  }, []);

  return <div>effect ref</div>;
}
