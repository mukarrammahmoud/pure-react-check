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

---

## Compiler Compatibility & Ground Truth Layer (`compiler-compat`)

`pure-react-check` includes an automated **Compiler Compatibility Layer** to continuously compare static predictions against actual React Compiler behavior across versioned fixtures.

```bash
npx pure-react-check compiler-compat
```

### Compatibility CLI Options:
- `--format=terminal|json`: Output format (default: `terminal`).
- `--rule=<ruleName>`: Filter verification to a single static rule (e.g. `--rule=no-render-mutation`).
- `--fixture=<substring>`: Filter verification to specific fixture path.
- `--ci`: Run in strict CI mode; fails if agreement rate drops below threshold.
- `--min-agreement=<percent>`: Minimum required agreement percentage (default: `80`).

### Terminal Compatibility Output:
```text
Pure React Check
React Compiler Compatibility Matrix
────────────────────────────────────────────────────────────────

Compiler version:       19.0.0-reference
Adapter name:           Reference Compiler Model
Tool version:           1.2.0

Fixtures evaluated:   46
  ✓ Agreement:         41
  ✗ Mismatch:           5
  ○ Unknown:           0

Agreement Rate:        89.1%
```

---

## Directives Support

`pure-react-check` natively understands React Compiler opt-in and opt-out directives:

- `"use no memo"` at function or module level → Component status marked as `OPTED OUT` (`○ OPTED OUT`)
- `"use memo"` at function or module level → Component status marked as `FORCED OPT-IN` (`⚡ FORCED OPT-IN`)

---

## CI/CD & Automation

Enforce compiler readiness thresholds in your CI pipelines:

### Preflight Readiness Check
```bash
npx pure-react-check compiler-report ./src --ci --max-bailouts=0 --min-readiness=95
```

### Compiler Compatibility Verification Check
```bash
npx pure-react-check compiler-compat --ci --min-agreement=85
```

---

## Baseline & Regression Tracking

Track readiness over time and catch regressions on Pull Requests:

```bash
# Capture baseline snapshot
npx pure-react-check compiler-report ./src --baseline

# Compare against baseline in PR
npx pure-react-check compiler-report ./src --diff --ci
```

---

## Programmatic Node.js API

Import the preflight analyzer or compatibility suite directly:

```ts
// 1. Static Compiler Preflight Analysis
import { analyseBailouts } from 'pure-react-check/api';
const report = await analyseBailouts({ target: './src' });
console.log(`Readiness: ${report.stats.compilerReadinessPercent.toFixed(1)}%`);

// 2. Compiler Compatibility Ground Truth Runner
import { runCompilerCompatibility } from 'pure-react-check/compiler';
const compatReport = await runCompilerCompatibility();
console.log(`Agreement rate: ${compatReport.summary.agreementPercent.toFixed(1)}%`);
```

---

## Local Development & Testing

```bash
# Typecheck
pnpm typecheck

# Run full test suite (unit tests + compiler-compat fixture suite)
pnpm test

# Run compatibility fixture suite only
pnpm test:compiler-compat

# Build distribution
pnpm build
```

---

## License

ISC
