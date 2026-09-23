import { useState } from 'react';

export function ConditionalHookComponent({ isEnabled }: { isEnabled: boolean }) {
  if (isEnabled) {
    const [val] = useState(0);
    return <div>Enabled: {val}</div>;
  }
  return <div>Disabled</div>;
}
