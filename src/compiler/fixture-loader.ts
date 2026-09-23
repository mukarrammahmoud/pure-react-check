/**
 * Filesystem-backed Fixture Loader for Ground Truth Fixtures.
 */

import fs from 'node:fs';
import path from 'node:path';
import fastGlob from 'fast-glob';
import type { CompilerFixture, FixtureCategory } from './types.js';

const VALID_CATEGORIES: ReadonlySet<string> = new Set<FixtureCategory>([
  'purity',
  'hooks',
  'memoization',
  'directives',
  'edge-cases',
]);

export interface FixtureLoader {
  loadAll(rootDir: string): Promise<CompilerFixture[]>;
  load(fixturePath: string): Promise<CompilerFixture>;
}

export class FileSystemFixtureLoader implements FixtureLoader {
  /**
   * Loads and validates a single fixture from its fixture.json file path
   * or from a directory containing fixture.json.
   */
  async load(fixturePath: string): Promise<CompilerFixture> {
    const resolvedPath = path.resolve(process.cwd(), fixturePath);

    let jsonFilePath: string;
    let fixtureDir: string;

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      jsonFilePath = path.join(resolvedPath, 'fixture.json');
      fixtureDir = resolvedPath;
    } else {
      jsonFilePath = resolvedPath;
      fixtureDir = path.dirname(resolvedPath);
    }

    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`Fixture file not found: ${jsonFilePath}`);
    }

    let parsed: unknown;
    try {
      const content = fs.readFileSync(jsonFilePath, 'utf-8');
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse fixture JSON at "${jsonFilePath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.validateFixture(parsed, jsonFilePath, fixtureDir);
  }

  /**
   * Recursively discovers and loads all fixture.json files within rootDir.
   * Throws if duplicate fixture IDs are detected.
   * Returns fixtures in deterministic order sorted by ID.
   */
  async loadAll(rootDir: string): Promise<CompilerFixture[]> {
    const resolvedRoot = path.resolve(process.cwd(), rootDir);

    if (!fs.existsSync(resolvedRoot)) {
      throw new Error(`Fixture root directory does not exist: ${resolvedRoot}`);
    }

    const jsonFiles = await fastGlob('**/fixture.json', {
      cwd: resolvedRoot,
      absolute: true,
      onlyFiles: true,
    });

    const fixtures: CompilerFixture[] = [];
    const seenIds = new Map<string, string>();

    for (const jsonFile of jsonFiles) {
      const fixtureDir = path.dirname(jsonFile);
      const fixture = await this.load(jsonFile);

      if (seenIds.has(fixture.id)) {
        const previousFile = seenIds.get(fixture.id);
        throw new Error(
          `Duplicate fixture ID detected: "${fixture.id}". ` +
          `Found in "${jsonFile}" and "${previousFile}". Fixture IDs must be unique across the entire suite.`,
        );
      }

      seenIds.set(fixture.id, jsonFile);
      fixtures.push(fixture);
    }

    // Deterministic ordering by ID
    fixtures.sort((a, b) => a.id.localeCompare(b.id));

    return fixtures;
  }

  private validateFixture(
    data: unknown,
    jsonFilePath: string,
    fixtureDir: string,
  ): CompilerFixture {
    if (!data || typeof data !== 'object') {
      throw new Error(`Malformed fixture at "${jsonFilePath}": content must be a JSON object.`);
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.id !== 'string' || obj.id.trim() === '') {
      throw new Error(`Malformed fixture at "${jsonFilePath}": missing or invalid string property "id".`);
    }

    if (typeof obj.category !== 'string' || !VALID_CATEGORIES.has(obj.category)) {
      throw new Error(
        `Malformed fixture "${obj.id}" at "${jsonFilePath}": category "${String(obj.category)}" is invalid. ` +
        `Expected one of: ${Array.from(VALID_CATEGORIES).join(', ')}.`,
      );
    }

    if (typeof obj.description !== 'string' || obj.description.trim() === '') {
      throw new Error(`Malformed fixture "${obj.id}" at "${jsonFilePath}": missing or invalid "description".`);
    }

    if (typeof obj.entry !== 'string' || obj.entry.trim() === '') {
      throw new Error(`Malformed fixture "${obj.id}" at "${jsonFilePath}": missing or invalid "entry" file path.`);
    }

    // Resolve entry file relative to fixture directory
    const resolvedEntry = path.isAbsolute(obj.entry)
      ? obj.entry
      : path.resolve(fixtureDir, obj.entry);

    if (!fs.existsSync(resolvedEntry)) {
      throw new Error(
        `Malformed fixture "${obj.id}" at "${jsonFilePath}": entry file "${obj.entry}" not found at "${resolvedEntry}".`,
      );
    }

    let tags: string[] | undefined;
    if (obj.tags !== undefined) {
      if (!Array.isArray(obj.tags) || obj.tags.some((t) => typeof t !== 'string')) {
        throw new Error(`Malformed fixture "${obj.id}" at "${jsonFilePath}": "tags" must be an array of strings.`);
      }
      tags = [...obj.tags];
    }

    return {
      id: obj.id.trim(),
      category: obj.category as FixtureCategory,
      description: obj.description.trim(),
      entry: resolvedEntry,
      tags,
    };
  }
}
