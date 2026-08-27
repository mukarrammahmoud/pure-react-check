// False Positive Guard: Imperative animation loop inside effect
import { useEffect } from 'react';

export function AnimationInEffectComp() {
  useEffect(() => {
    let handle: number;
    const animate = () => {
      handle = requestAnimationFrame(animate);
    };
    handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, []);

  return <div>animating</div>;
}
