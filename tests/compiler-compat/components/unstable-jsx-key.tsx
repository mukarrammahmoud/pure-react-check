// Rule: no-unstable-jsx-key
export function UnstableJsxKeyComp(props: { items: string[] }) {
  return (
    <ul>
      {props.items.map((item) => (
        <li key={Math.random()}>{item}</li>
      ))}
    </ul>
  );
}
