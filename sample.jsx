import React from 'react';

export function UserProfile({ name }) {
  let visits = 0;

  // INVALID: Impurity Violation (Mutating directly during render phase)
  visits = visits + 1;

  const handleClick = () => {
    // VALID: Mutation inside an event handler (NOT during render)
    visits = visits + 1;
  };

  return (
    <div>
      <h1>Hello, {name}</h1>
      <button onClick={handleClick}>Increment</button>
      <button onClick={() => { visits = visits + 1; }}>Inline Event</button>
    </div>
  );
}
