// False Positive Guard: DOM access inside useEffect
import { useEffect } from 'react';

export function DomInEffectComp() {
  useEffect(() => {
    document.title = 'Updated Title'; // Safe inside effect
  }, []);

  return <div>dom in effect</div>;
}
