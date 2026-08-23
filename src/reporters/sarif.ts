import fs from 'node:fs';
import path from 'node:path';
import type { ScanResult } from '../scanner.js';

// SARIF 2.1.0 — https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: SarifDriver };
  results: SarifResult[];
  invocations: SarifInvocation[];
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri: string;
  properties: { tags: string[] };
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: SarifLocation[];
  fixes?: SarifFix[];
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId: string };
    region: { startLine: number };
  };
}

interface SarifFix {
  description: { text: string };
}

interface SarifInvocation {
  executionSuccessful: boolean;
  toolExecutionNotifications: SarifNotification[];
}

interface SarifNotification {
  level: 'error';
  message: { text: string };
  locations: SarifLocation[];
}

const RULE_META: Record<string, { name: string; description: string; tags: string[] }> = {
  'no-render-mutation': { name: 'NoRenderMutation', description: 'Detects variable mutations during render.', tags: ['react', 'correctness'] },
  'no-ref-read-in-render': { name: 'NoRefReadInRender', description: 'Detects ref.current reads during render.', tags: ['react', 'compiler'] },
  'no-impure-calls': { name: 'NoImpureCalls', description: 'Detects impure calls (Math.random, Date.now) in render.', tags: ['react', 'purity'] },
  'no-set-state-in-render': { name: 'NoSetStateInRender', description: 'Detects setState/dispatch calls during render.', tags: ['react', 'correctness'] },
  'no-prop-state-mutation': { name: 'NoPropStateMutation', description: 'Detects mutation of props or state.', tags: ['react', 'correctness'] },
  'no-nested-components': { name: 'NoNestedComponents', description: 'Detects component definitions nested in another component.', tags: ['react', 'performance'] },
  'no-dom-globals-in-render': { name: 'NoDomGlobalsInRender', description: 'Detects DOM global access during render.', tags: ['react', 'ssr'] },
  'no-mutation-after-jsx': { name: 'NoMutationAfterJsx', description: 'Detects mutations of objects passed to JSX props.', tags: ['react', 'compiler'] },
  'no-conditional-hooks': { name: 'NoConditionalHooks', description: 'Detects hooks called inside conditionals or loops.', tags: ['react', 'rules-of-hooks'] },
  'no-global-variable-mutation': { name: 'NoGlobalVariableMutation', description: 'Detects module-level variable mutations in render.', tags: ['react', 'purity'] },
  'no-unstable-default-props': { name: 'NoUnstableDefaultProps', description: 'Detects unstable literals as default prop values.', tags: ['react', 'compiler', 'performance'] },
  'no-async-component': { name: 'NoAsyncComponent', description: 'Detects async component functions.', tags: ['react', 'correctness'] },
  'no-unstable-jsx-key': { name: 'NoUnstableJsxKey', description: 'Detects missing or impure JSX keys in lists.', tags: ['react', 'correctness'] },
  'no-timer-in-render': { name: 'NoTimerInRender', description: 'Detects timer calls during render.', tags: ['react', 'correctness'] },
  'no-ref-as-dependency': { name: 'NoRefAsDependency', description: 'Detects ref.current in hook dependency arrays.', tags: ['react', 'correctness'] },
};

function toSarifRule(ruleId: string): SarifRule {
  const meta = RULE_META[ruleId] ?? { name: ruleId, description: ruleId, tags: ['react'] };
  return {
    id: ruleId,
    name: meta.name,
    shortDescription: { text: meta.description },
    helpUri: `https://www.npmjs.com/package/pure-react-check#${ruleId}`,
    properties: { tags: meta.tags },
  };
}

export function generateSarifReport(
  result: ScanResult,
  score: number,
  outputPath = 'pure-react-check-report.sarif',
): string {
  const absolutePath = path.resolve(outputPath);
  const allRuleIds = [...new Set([...Object.keys(RULE_META)])];

  const sarifResults: SarifResult[] = result.violations.map((v) => ({
    ruleId: v.rule,
    level: 'error',
    message: { text: v.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: v.filePath.replaceAll('\\', '/'), uriBaseId: '%SRCROOT%' },
          region: { startLine: v.line || 1 },
        },
      },
    ],
    fixes: [{ description: { text: v.recommendation } }],
  }));

  const notifications: SarifNotification[] = result.errors.map((e) => ({
    level: 'error',
    message: { text: e.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: e.filePath.replaceAll('\\', '/'), uriBaseId: '%SRCROOT%' },
          region: { startLine: 1 },
        },
      },
    ],
  }));

  const sarif: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'pure-react-check',
            version: '1.0.1',
            informationUri: 'https://www.npmjs.com/package/pure-react-check',
            rules: allRuleIds.map(toSarifRule),
          },
        },
        results: sarifResults,
        invocations: [
          {
            executionSuccessful: result.errors.length === 0,
            toolExecutionNotifications: notifications,
          },
        ],
      },
    ],
  };

  fs.writeFileSync(absolutePath, JSON.stringify(sarif, null, 2), 'utf8');
  return absolutePath;
}
