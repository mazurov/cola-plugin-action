import * as core from '@actions/core';
import * as path from 'path';
import { logger } from './utils/logger';
import { findPluginDirectories, readManifest, validateManifest } from './utils/manifest';

/**
 * Validate plugin manifests
 */

export interface ValidateOptions {
  pluginsDirectory: string;
}

export interface ValidateResult {
  validPlugins: string[];
  invalidPlugins: string[];
  totalErrors: number;
  totalWarnings: number;
}

export async function validatePlugins(options: ValidateOptions): Promise<ValidateResult> {
  logger.header('Validating Plugin Manifests');

  const { pluginsDirectory } = options;

  logger.info(`Plugins directory: ${pluginsDirectory}`);

  // Find all plugin directories
  const pluginDirs = await findPluginDirectories(pluginsDirectory);

  if (pluginDirs.length === 0) {
    throw new Error(`No plugins found in ${pluginsDirectory}`);
  }

  logger.info(`Found ${pluginDirs.length} plugin(s)`);

  const validPlugins: string[] = [];
  const invalidPlugins: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Validate each plugin
  for (const pluginDir of pluginDirs) {
    const pluginName = path.basename(pluginDir);

    logger.startGroup(`Validating: ${pluginName}`);

    try {
      // Read manifest
      const manifest = await readManifest(pluginDir);

      logger.info(`Package: ${manifest.pkgName}`);
      logger.info(`Version: ${manifest.version}`);
      logger.info(`Commands: ${manifest.cmds.length}`);

      if (manifest._metadata) {
        if (manifest._metadata.author) logger.info(`Author: ${manifest._metadata.author}`);
        if (manifest._metadata.license) logger.info(`License: ${manifest._metadata.license}`);
        if (manifest._metadata.repository)
          logger.info(`Repository: ${manifest._metadata.repository}`);
      }

      // Validate manifest
      const validation = validateManifest(manifest);

      // Log errors
      if (validation.errors.length > 0) {
        logger.error(`Found ${validation.errors.length} error(s):`);
        for (const error of validation.errors) {
          logger.error(`  - ${error}`);
        }
        invalidPlugins.push(pluginName);
        totalErrors += validation.errors.length;
      } else {
        validPlugins.push(pluginName);
        logger.success('Manifest is valid');
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        logger.warning(`Found ${validation.warnings.length} warning(s):`);
        for (const warning of validation.warnings) {
          logger.warning(`  - ${warning}`);
        }
        totalWarnings += validation.warnings.length;
      }
    } catch (error) {
      logger.error(
        `Failed to validate ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
      );
      invalidPlugins.push(pluginName);
      totalErrors++;
    } finally {
      logger.endGroup();
    }
  }

  // Summary
  logger.header('Validation Summary');
  logger.info(`Total plugins: ${pluginDirs.length}`);
  logger.info(`Valid: ${validPlugins.length}`);
  logger.info(`Invalid: ${invalidPlugins.length}`);
  logger.info(`Total errors: ${totalErrors}`);
  logger.info(`Total warnings: ${totalWarnings}`);

  if (invalidPlugins.length > 0) {
    logger.error('❌ Validation failed');
    logger.error(`Invalid plugins: ${invalidPlugins.join(', ')}`);
  } else {
    logger.success('✅ All plugins are valid!');
  }

  // Set outputs
  core.setOutput('validated-plugins', JSON.stringify(validPlugins));
  core.setOutput('valid-count', validPlugins.length);
  core.setOutput('invalid-count', invalidPlugins.length);

  return {
    validPlugins,
    invalidPlugins,
    totalErrors,
    totalWarnings,
  };
}
