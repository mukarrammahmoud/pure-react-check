import React from 'react';

export function ChainedAliasMutationComp(props: { user: { name: string } }) {
  const obj = props.user;
  const alias = obj;
  alias.name = 'mutated'; // Indirect mutation through multi-hop chain

  return <div>{alias.name}</div>;
}
