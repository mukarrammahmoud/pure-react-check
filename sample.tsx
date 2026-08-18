
import { useMemo } from 'react';

type UserProfileProps = {
  name: string;
};

export function UserProfile({ name }: UserProfileProps) {
  let visits = 0;

  // INVALID: Impurity Violation (Mutating directly during render phase)
  visits = visits + 1;

  const id = Math.random();
  const timestamp = Date.now();
  const memoizedId = useMemo(() => Math.random(), []);

  const handleClick = () => {
    // VALID: Mutation inside an event handler (NOT during render)
    visits = visits + 1;
    Date.now();
  };

  return (
    <div>
      <h1>Hello, {name}</h1>
      <button onClick={handleClick}>Increment</button>
      <button onClick={() => { visits = visits + 1; }}>Inline Event</button>
    </div>
  );
}
