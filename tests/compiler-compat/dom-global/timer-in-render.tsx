// Rule: no-timer-in-render
export function TimerInRenderComp() {
  setTimeout(() => console.log('timer'), 1000); // Timer registration in render
  return <div>timer</div>;
}
