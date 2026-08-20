import { useEffect, useMemo, useRef, useState } from 'react';

function ModuleChild() {
  return <span>Valid module component</span>;
}

export function AllRulesSample({ props, items }: { props: { user: { name: string }; id?: string }; items: string[] }) {
  const [count, setCount] = useState(0);
  const [state, dispatch] = useState({ ready: false });
  const renderRef = useRef(0);
  const playerRef = useRef<{ play: () => void } | null>(null);

  // VIOLATION: no-ref-read-in-render
  const currentRender = renderRef.current;

  // VALID: lazy ref initialization is allowed
  if (playerRef.current === null) {
    playerRef.current = { play: () => console.log('play') };
  }

  setCount((value) => value + 1);
  dispatch({ ready: true });
  props.user.name = 'invalid';
  items.push('invalid');
  delete props.id;

  function NestedChild() {
    return <span>Invalid nested component</span>;
  }
  function TodoList({ items }: { items: Array<{ id: number; text: string }> }) {
    // VIOLATION: Directly mutating the items prop during render
    items.push({ id: 99, text: 'New Item' }); 
  
    return (
      <ul>
        {items.map(item => <li key={item.id}>{item.text}</li>)}
      </ul>
    );
  }
  
  const NestedArrow = () => <span>Invalid nested arrow component</span>;
  const id = Math.random();
  document.title = 'invalid';
  localStorage.setItem('key', 'invalid');
  window.addEventListener('resize', () => undefined);
  fetch('/invalid');

  useMemo(() => Math.random(), []);
  useEffect(() => {
    setCount((value) => value + 1);
    document.title = 'valid effect';
    // VALID: reading ref inside useEffect
    console.log(renderRef.current);
  }, []);

  const handleClick = () => {
    setCount((value) => value + 1);
    Date.now();
    // VALID: reading ref inside event handler
    console.log(renderRef.current);
  };

  return (
    <div onClick={handleClick}>
      <ModuleChild />
      <NestedChild />
      <NestedArrow />
      <TodoList items={[]} />
      <p>{count + (state.ready ? id : 0) + currentRender}</p>
    </div>
  );
}

