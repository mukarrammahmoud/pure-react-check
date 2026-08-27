// Directive fixtures: module-level "use no memo" opts out all components
"use no memo";

export function CompA() {
  return <div>A</div>;
}

export function CompB() {
  return <div>B</div>;
}
