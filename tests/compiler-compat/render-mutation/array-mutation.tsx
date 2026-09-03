/**
 * Fixture: Prop array mutation
 *
 * Tests that array mutations on prop/state values are detected
 * while mutations on locally-created arrays are NOT flagged.
 */
import React, { useState } from 'react';

// Should detect: mutating prop array
export function PropArrayMutation({ items }: { items: string[] }) {
  items.push('new item'); // direct prop mutation
  return <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

// Should be clean: mutating locally-created array
export function LocalArrayMutation() {
  const items: string[] = [];
  items.push('safe');
  items.push('also safe');
  return <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}
