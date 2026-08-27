// Rule: no-prop-state-mutation
export function PropMutationComp(props: { items: string[] }) {
  props.items.push('new item'); // Direct prop array mutation during render
  return <div>{props.items.length}</div>;
}
