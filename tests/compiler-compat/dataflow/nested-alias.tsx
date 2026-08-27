import React from 'react';

export function NestedAliasMutationComp(props: { config: { settings: { enabled: boolean } } }) {
  const target = props.config;
  const value = target.settings;
  value.enabled = true; // Indirect mutation through nested member alias

  return <div>{value.enabled ? 'Yes' : 'No'}</div>;
}
