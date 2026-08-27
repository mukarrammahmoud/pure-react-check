// Rule: no-mutation-after-jsx
export function MutationAfterJsxComp() {
  const data = { title: 'Initial' };
  const element = <div>{data.title}</div>;
  data.title = 'Mutated after JSX capture'; // Mutation after JSX use
  return element;
}
