import { useEffect, useMemo, useState } from 'react';

function ModuleChild() {
  return <span>Valid module component</span>;
}

export function AllRulesSample({ props, items }: { props: { user: { name: string }; id?: string }; items: string[] }) {
  const [count, setCount] = useState(0);
  const [state, dispatch] = useState({ ready: false });

  setCount((value) => value + 1);
  dispatch({ ready: true });
  props.user.name = 'invalid';
  items.push('invalid');
  delete props.id;

  function NestedChild() {
    return <span>Invalid nested component</span>;
  }
  function TodoList({ items }) {
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
  }, []);

  const handleClick = () => {
    setCount((value) => value + 1);
    Date.now();
  };

  return (
    <div onClick={handleClick}>
      <ModuleChild />
      <NestedChild />
      <NestedArrow />
      <TodoList />
      <p>{count + (state.ready ? id : 0)}</p>
    </div>
  );
}
