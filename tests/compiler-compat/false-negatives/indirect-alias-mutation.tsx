// False Negative Case: Indirect mutation via intermediate variable alias
export function IndirectAliasMutationComp(props: { user: { name: string } }) {
  const alias = props.user;
  alias.name = 'Mutated via alias'; // Indirect prop mutation
  return <div>{alias.name}</div>;
}
