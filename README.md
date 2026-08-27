# pure-react-check

`pure-react-check` is a static analysis CLI and programmatic tool that serves as a **React Compiler Preflight Analyzer**.

It inspects React TypeScript and JavaScript code for render-phase pattern violations that threaten component purity or trigger React Compiler optimization bailouts.

> [!IMPORTANT]
> **Compiler Preflight Companion Notice**
> `pure-react-check` is **NOT a replacement for the React Compiler**. It is a static analysis companion designed to give early, machine-readable, and actionable feedback in your editor and CI before compiling. All predictions (e.g. `COMPILER READY`, `PREDICTED BAILOUT`) are static pattern heuristics; the React Compiler remains the authoritative source of truth.

---

## What It Checks

### Render Purity & Integrity
- `no-render-mutation`: Mutation of local variables or render values during the render body.
- `no-prop-state-mutation`: Direct mutation of props, state objects, or arrays during render.
- `no-global-variable-mutation`: Mutation of module-level `let`/`var` variables inside render functions.
- `no-mutation-after-jsx`: Mutating values after passing them into JSX elements (ordering hazards).
- `no-ref-read-in-render`: Reading `ref.current` during render (breaks referential stability guarantees).
- `no-ref-as-dependency`: Listing `ref` objects in hook dependency arrays (stale-closure hazards).
- `no-impure-calls`: Invoking impure functions (`Math.random()`, `Date.now()`) during render.
- `no-dom-globals-in-render`: Render-time access to browser globals (`document`, `window`, `localStorage`).
- `no-timer-in-render`: Registering timers (`setTimeout`, `setInterval`) during render.
- `no-set-state-in-render`: Unconditional `setState` or `dispatch` calls during render (re-render loops).

### Component Structure & Hooks
- `no-conditional-hooks`: Hooks called inside conditional branches, loops, or nested functions.
- `no-async-component`: Client components declared as `async`.
- `no-nested-components`: Component definitions nested inside another component's body.
- `no-unstable-default-props`: Object or array literals used as prop default values.
- `no-unstable-jsx-key`: Missing `key` prop or impure keys on JSX elements inside loops.

---

## Quick Start (Compiler Preflight Mode)

Run the compiler report on your source directory:

```bash
npx pure-react-check compiler-report ./src
```

### Concise UX (Default)
Prints a clean score card and lists only components with predicted bailouts or risks:

```text
Pure React Check
React Compiler Preflight Analyzer
────────────────────────────────────────────────────────────────

Compiler Readiness   85.0%
Heuristic score based on static analysis.

Components           10
  ✓ Ready            8
  ✗ Predicted Bailout 2
  ⚠ At Risk          0
  ○ Opted Out        0
  ⚡ Forced Opt-In   0

Predicted Bailouts (2)
  MyComponent [component] ✗ PREDICTED BAILOUT
    src/components/MyComponent.tsx:14
    • mutation-during-render
```

### Detailed UX (`--explain`)
Pass `--explain` for full diagnostic breakdowns:

```bash
npx pure-react-check compiler-report ./src --explain
```

Output includes:
- **Detection Confidence**: `HIGH`, `MEDIUM`, or `LOW` (reliability of AST pattern matching)
- **Bailout Likelihood**: `DEFINITE`, `LIKELY`, or `POSSIBLE` (predicted compiler behaviour)
- **Why this matters**: Educational breakdown of the React purity violation
- **Blocked Optimisation**: Which compiler scope optimization is prevented
- **Suggested Direction**: Actionable refactoring guidance

---

## Directives Support

`pure-react-check` natively understands React Compiler opt-in and opt-out directives:

- `"use no memo"` at function or module level → Component status marked as `OPTED OUT` (`○ OPTED OUT`)
- `"use memo"` at function or module level → Component status marked as `FORCED OPT-IN` (`⚡ FORCED OPT-IN`)

Directives are recognized as developer intent and do not generate false-positive rule violations.

---

## CI/CD & Automation

Enforce compiler readiness thresholds in your CI pipelines:

### Strict CI Mode (`--ci`)
```bash
npx pure-react-check compiler-report ./src --ci --max-bailouts=0 --min-readiness=95
```

Flags:
- `--ci`: Enables strict status checking; exits with code `1` if criteria are not met.
- `--max-bailouts=<n>`: Maximum allowed `predicted-bailout` components (e.g. `--max-bailouts=0`).
- `--min-readiness=<percent>`: Minimum acceptable readiness score (e.g. `--min-readiness=90`).
- `--fail-on=any|new`: Fail on any bailout, or only on new regressions.

---

## Baseline & Regression Tracking

Track readiness over time and catch regressions on Pull Requests:

### 1. Capture a Baseline
```bash
npx pure-react-check compiler-report ./src --baseline
```
Saves snapshot to `.pure-react-check-baseline.json`.

### 2. Compare in PR Build (`--diff`)
```bash
npx pure-react-check compiler-report ./src --diff --ci
```
Prints a regression summary showing score delta and any components whose status degraded. Exits with code `1` if regressions were introduced.

---

## Programmatic Node.js API

Import the preflight analyzer directly in Node.js tools, dashboards, or build plugins:

```ts
import {
  analyseBailouts,
  saveBaseline,
  loadBaseline,
  compareToBaseline,
} from 'pure-react-check/api';

// Run analysis
const report = await analyseBailouts({ target: './src' });

console.log(`Schema version: ${report.schemaVersion}`); // 2
console.log(`Score version:  ${report.scoreVersion}`);  // 2
console.log(`Readiness:      ${report.stats.compilerReadinessPercent.toFixed(1)}%`);

// Inspect per-component predictions
for (const comp of report.components) {
  console.log(`${comp.name} (${comp.kind}): ${comp.status}`);
  if (comp.prediction) {
    console.log(`  Outcome:    ${comp.prediction.outcome}`);
    console.log(`  Likelihood: ${comp.prediction.likelihood}`);
    console.log(`  Reason:     ${comp.prediction.reason}`);
  }
}
```

---

## JSON Output Schema (v2)

Generate machine-readable JSON for integration with custom dashboards:

```bash
npx pure-react-check compiler-report ./src --format json
```

Output: `pure-react-bailout-report.json`

```json
{
  "schemaVersion": 2,
  "scoreVersion": 2,
  "toolVersion": "1.2.0",
  "generatedAt": "2026-08-27T19:00:00.000Z",
  "target": "./src",
  "stats": {
    "compilerReadinessPercent": 85.0,
    "totalFiles": 5,
    "totalComponents": 10,
    "readyComponents": 8,
    "predictedBailoutComponents": 2,
    "atRiskComponents": 0,
    "optedOutComponents": 0,
    "forcedOptInComponents": 0,
    "totalViolations": 2,
    "definiteLikelihood": 2,
    "likelyLikelihood": 0,
    "possibleLikelihood": 0
  },
  "components": [
    {
      "name": "MyComponent",
      "kind": "component",
      "filePath": "src/MyComponent.tsx",
      "line": 14,
      "status": "predicted-bailout",
      "prediction": {
        "outcome": "bailout",
        "likelihood": "definite",
        "reason": "A value is mutated inside the render body..."
      },
      "violations": [...]
    }
  ]
}
```

---

## Local Development & Testing

```bash
# Typecheck
pnpm typecheck

# Run full test suite (including compiler-compat fixture suite)
pnpm test

# Build distribution
pnpm build
```

---

## License

ISC
