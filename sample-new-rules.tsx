import { useEffect, useMemo, useRef } from 'react';

let globalCount = 0;

// Rule 5: no-async-component
// Rule 4: no-unstable-default-props
export async function NewRulesSample({ items = [], user = { name: 'Guest' } }) {
  const myRef = useRef(0);

  // Rule 3: no-global-variable-mutation
  globalCount++;

  // Rule 7: no-timer-in-render
  setTimeout(() => console.log('Timer in render'), 1000);

  // Rule 2: no-conditional-hooks
  if (items.length > 0) {
    useEffect(() => {
      console.log('Conditional hook');
    }, []);
  }

  // Rule 8: no-ref-as-dependency
  const memoizedValue = useMemo(() => {
    return myRef.current * 2;
  }, [myRef.current]);

  const element = <div id="test">{user.name}</div>;

  // Rule 1: no-mutation-after-jsx
  user.name = 'Updated';

  return (
    <div>
      {element}
      {/* Rule 6: no-unstable-jsx-key (missing key & impure key) */}
      {items.map((item) => (
        <span key={Math.random()}>{item}</span>
      ))}
    </div>
  );
}
