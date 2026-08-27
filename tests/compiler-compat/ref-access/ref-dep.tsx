// Rule: no-ref-as-dependency
import { useRef, useEffect } from 'react';

export function RefAsDependencyComp() {
  const ref = useRef(0);

  useEffect(() => {
    console.log(ref.current);
  }, [ref.current]); // ref.current passed as hook dependency

  return <div>ok</div>;
}
