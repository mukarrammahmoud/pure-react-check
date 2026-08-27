// Directive fixtures: function-level directives — only A is opted out
export function OptedOut() {
  "use no memo";
  return <div>opted out</div>;
}

export function StillReady() {
  return <div>compiler ready</div>;
}

export function ForcedIn() {
  "use memo";
  return <div>forced opt-in</div>;
}
