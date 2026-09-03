/**
 * Fixture: Destructured prop mutation
 *
 * Tests that mutations via destructured variables are correctly
 * linked back to props. This should be detected as a compiler bailout.
 */
import React from 'react';

// Should detect: destructured prop mutation
export function DestructuredPropMutation({ user }: { user: { name: string } }) {
  user.name = 'mutated'; // mutation via destructured prop
  return <div>{user.name}</div>;
}

// Should detect: nested destructured mutation
export function NestedDestructuredMutation({ data }: { data: { settings: { theme: string } } }) {
  const { settings } = data;
  settings.theme = 'dark'; // indirect mutation
  return <div>{settings.theme}</div>;
}

// Should be clean: no mutation
export function CleanDestructured({ items }: { items: string[] }) {
  return <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}
