// Rule: no-conditional-hooks
import { useState } from 'react';

export function ConditionalHookComp(props: { flag: boolean }) {
  if (props.flag) {
    const [state] = useState(0); // Conditional hook call inside if statement
    return <div>{state}</div>;
  }
  return <div>disabled</div>;
}
