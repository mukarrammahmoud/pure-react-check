import fs from 'node:fs';
import path from 'node:path';

export interface PureReactCheckConfig {
  target: string;
  threshold?: number;
  format: 'terminal' | 'html' | 'json' | 'sarif';
  ignore?: string[];
  rules?: Record<string, 'error' | 'warn' | 'off'>;
}

const CONFIG_FILE_NAMES = [
  '.purereactrc.json',
  '.purereactrc',
  'purereact.config.json',
];

function tryReadJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isValidFormat(value: unknown): value is PureReactCheckConfig['format'] {
  return value === 'terminal' || value === 'html' || value === 'json' || value === 'sarif';
}

/**
 * Searches upward from cwd for a config file and returns its parsed contents,
 * or null when no config file is found.
 */
export function loadConfig(cwd = process.cwd()): Partial<PureReactCheckConfig> | null {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(cwd, name);
    if (!fs.existsSync(filePath)) continue;
    const raw = tryReadJson(filePath);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const data = raw as Record<string, unknown>;

    const config: Partial<PureReactCheckConfig> = {};
    if (typeof data['target'] === 'string') config.target = data['target'];
    if (typeof data['threshold'] === 'number') config.threshold = data['threshold'];
    if (isValidFormat(data['format'])) config.format = data['format'];
    if (Array.isArray(data['ignore']) && data['ignore'].every((s) => typeof s === 'string')) {
      config.ignore = data['ignore'] as string[];
    }
    if (data['rules'] && typeof data['rules'] === 'object' && !Array.isArray(data['rules'])) {
      config.rules = data['rules'] as PureReactCheckConfig['rules'];
    }
    return config;
  }
  return null;
}
