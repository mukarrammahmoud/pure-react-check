// False Positive Guard: Ref access in event handler
import { useRef } from 'react';

export function RefInHandlerComp() {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (btnRef.current) {
      btnRef.current.focus(); // Safe inside event handler
    }
  };

  return <button ref={btnRef} onClick={handleClick}>click</button>;
}
