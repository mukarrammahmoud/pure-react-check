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

## CLI Reference

### Global Options

```bash
npx pure-react-check --help        # Show full usage documentation
npx pure-react-check --version     # Show version number
```

### `compiler-report` — Preflight Analysis

```bash
npx pure-react-check compiler-report [target] [options]
```

| Option | Description |
|---|---|
| `--explain` | Show detailed per-violation explanations |
| `--format=terminal\|json` | Output format (default: `terminal`) |
| `--ci` | Enable CI mode (exit 1 on failures) |
| `--max-bailouts=<n>` | CI: max predicted-bailout components allowed |
| `--min-readiness=<n>` | CI: minimum readiness percentage required |
| `--fail-on=any\|new` | CI: fail on any bailout (`any`) or only new ones (`new`) |
| `--baseline` | Capture a readiness baseline snapshot |
| `--diff` | Compare current scan against saved baseline |

### `compiler-compat` — Compatibility Suite

```bash
npx pure-react-check compiler-compat [dir] [options]
```

| Option | Description |
|---|---|
| `--format=terminal\|json` | Output format (default: `terminal`) |
| `--rule=<ruleName>` | Filter verification to a single rule |
| `--fixture=<substring>` | Filter verification to specific fixture path |
| `--ci` | Run in strict CI mode |
| `--min-agreement=<n>` | Minimum required agreement percentage (default: `80`) |

### `scan` — Legacy File-Level Scan

```bash
npx pure-react-check scan [target] [options]
```

| Option | Description |
|---|---|
| `--format=terminal\|html\|json\|sarif` | Output format (default: `terminal`) |
| `--threshold=<n>` | Minimum readiness threshold percentage |

---

## Compiler Compatibility & Ground Truth Layer (`compiler-compat`)

`pure-react-check` includes an automated **Compiler Compatibility Layer** to continuously compare static predictions against actual React Compiler behavior across versioned fixtures.

```bash
npx pure-react-check compiler-compat
```

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

## Configuration

Create a `.purereactrc.json` or `purereact.config.json` in your project root:

```json
{
  "target": "./src",
  "format": "terminal",
  "threshold": 80,
  "ignore": ["**/test/**", "**/stories/**", "**/__mocks__/**"],
  "rules": {
    "no-nested-components": "warn",
    "no-unstable-default-props": "off",
    "no-ref-as-dependency": "error"
  }
}
```

### Config Fields

| Field | Type | Description |
|---|---|---|
| `target` | `string` | Default scan target directory or glob |
| `format` | `"terminal" \| "html" \| "json" \| "sarif"` | Default output format |
| `threshold` | `number` | Minimum readiness score (0–100) |
| `ignore` | `string[]` | Additional glob patterns to ignore (merged with defaults) |
| `rules` | `Record<string, "error" \| "warn" \| "off">` | Per-rule severity overrides |

**Default ignore patterns** (always applied): `**/node_modules/**`, `**/dist/**`, `**/build/**`

Rules set to `"off"` are completely skipped during analysis. This applies to both the `compiler-report` and legacy `scan` commands.

---

## CI/CD & Automation

Enforce compiler readiness thresholds in your CI pipelines:

### Preflight Readiness Check
```bash
npx pure-react-check compiler-report ./src --ci --max-bailouts=0 --min-readiness=95
```

### Fail on Any Bailout
```bash
npx pure-react-check compiler-report ./src --ci --fail-on=any
```

### Fail Only on New Bailouts (with baseline diff)
```bash
npx pure-react-check compiler-report ./src --diff --ci --fail-on=new
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
const report = await analyseBailouts({
  target: './src',
  ignore: ['**/test/**'],
  rules: { 'no-nested-components': 'off' },
});
console.log(`Readiness: ${report.stats.compilerReadinessPercent.toFixed(1)}%`);

// 2. Compiler Compatibility Ground Truth Runner
import { runCompilerCompatibility } from 'pure-react-check/compiler';
const compatReport = await runCompilerCompatibility();
console.log(`Agreement rate: ${compatReport.summary.agreementPercent.toFixed(1)}%`);

// 3. Direct Scanner with Custom Options
import { scanDirectory } from 'pure-react-check/api';
const result = await scanDirectory('./src', {
  ignore: ['**/stories/**'],
  rules: { 'no-unstable-default-props': 'off' },
});
console.log(`Files: ${result.files.length}, Violations: ${result.violations.length}`);
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
