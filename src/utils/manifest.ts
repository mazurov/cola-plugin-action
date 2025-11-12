import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
import semver from 'semver';
import { PluginManifest, ValidationResult } from '../types/manifest';
import { logger } from './logger';

/**
 * Manifest parsing and validation utilities
 */

export async function readManifest(pluginDir: string): Promise<PluginManifest> {
  const manifestPath = path.join(pluginDir, 'manifest.mf');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');

    // Try parsing as YAML (supports both YAML and JSON)
    const manifest = YAML.parse(content) as PluginManifest;

    if (!manifest) {
      throw new Error('Empty manifest file');
    }

    return manifest;
  } catch (error) {
    throw new Error(
      `Failed to read manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function validateManifest(manifest: PluginManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!manifest.pkgName) {
    errors.push('Missing required field: pkgName');
  }

  if (!manifest.version) {
    errors.push('Missing required field: version');
  } else if (manifest.version.startsWith('v')) {
    errors.push(
      `Invalid version format: ${manifest.version}. Remove 'v' prefix (e.g., use 1.0.0 instead of v1.0.0)`
    );
  } else if (!semver.valid(manifest.version)) {
    errors.push(`Invalid version format: ${manifest.version}. Must be valid semver (e.g., 1.0.0)`);
  }

  if (!manifest.cmds || manifest.cmds.length === 0) {
    errors.push('Missing required field: cmds (must have at least one command)');
  }

  // Validate commands
  if (manifest.cmds) {
    for (let i = 0; i < manifest.cmds.length; i++) {
      const cmd = manifest.cmds[i];

      if (!cmd.name) {
        errors.push(`Command at index ${i} is missing 'name' field`);
      }

      if (!cmd.type) {
        errors.push(`Command '${cmd.name}' is missing 'type' field`);
      } else if (!['executable', 'alias', 'group'].includes(cmd.type)) {
        errors.push(`Command '${cmd.name}' has invalid type: ${cmd.type}`);
      }

      // Validate command name format (lowercase, alphanumeric, hyphens)
      if (cmd.name && !/^[a-z0-9-]+$/.test(cmd.name)) {
        errors.push(
          `Command name '${cmd.name}' contains invalid characters. Use lowercase letters, numbers, and hyphens only.`
        );
      }
    }
  }

  // Optional metadata warnings
  if (!manifest._metadata?.author) {
    warnings.push('Missing recommended field: _metadata.author');
  }

  if (!manifest._metadata?.license) {
    warnings.push('Missing recommended field: _metadata.license');
  }

  if (!manifest._metadata?.repository) {
    warnings.push('Missing recommended field: _metadata.repository');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function findPluginDirectories(pluginsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const dirs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(pluginsDir, entry.name, 'manifest.mf');
        try {
          await fs.access(manifestPath);
          dirs.push(path.join(pluginsDir, entry.name));
        } catch {
          logger.debug(`Skipping ${entry.name} - no manifest.mf found`);
        }
      }
    }

    return dirs;
  } catch (error) {
    throw new Error(
      `Failed to read plugins directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function parsePluginArchiveName(filename: string): { name: string; version: string } | null {
  const basename = filename.replace('.tar.gz', '');

  // Match pattern: plugin-name-version
  const match = basename.match(/^(.+)-(\d+\.\d+\.\d+.*)$/);

  if (match) {
    return {
      name: match[1],
      version: match[2],
    };
  }

  return null;
}
