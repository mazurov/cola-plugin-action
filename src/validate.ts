import * as core from '@actions/core';
import * as path from 'path';
import { logger } from './utils/logger';
import { findPackageDirectories, readManifest, validateManifest } from './utils/manifest';

/**
 * Validate package manifests
 */

export interface ValidateOptions {
  packagesDirectory: string;
}

export interface ValidateResult {
  validPackages: string[];
  invalidPackages: string[];
  totalErrors: number;
  totalWarnings: number;
}

export async function validatePackages(options: ValidateOptions): Promise<ValidateResult> {
  logger.header('Validating Package Manifests');

  const { packagesDirectory } = options;

  logger.info(`Packages directory: ${packagesDirectory}`);

  // Find all package directories
  const packageDirs = await findPackageDirectories(packagesDirectory);

  if (packageDirs.length === 0) {
    throw new Error(`No packages found in ${packagesDirectory}`);
  }

  logger.info(`Found ${packageDirs.length} package(s)`);

  const validPackages: string[] = [];
  const invalidPackages: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Validate each package
  for (const packageDir of packageDirs) {
    const packageName = path.basename(packageDir);

    logger.startGroup(`Validating: ${packageName}`);

    try {
      // Read manifest
      const manifest = await readManifest(packageDir);

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
        invalidPackages.push(packageName);
        totalErrors += validation.errors.length;
      } else {
        validPackages.push(packageName);
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
        `Failed to validate ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
      invalidPackages.push(packageName);
      totalErrors++;
    } finally {
      logger.endGroup();
    }
  }

  // Summary
  logger.header('Validation Summary');
  logger.info(`Total packages: ${packageDirs.length}`);
  logger.info(`Valid: ${validPackages.length}`);
  logger.info(`Invalid: ${invalidPackages.length}`);
  logger.info(`Total errors: ${totalErrors}`);
  logger.info(`Total warnings: ${totalWarnings}`);

  if (invalidPackages.length > 0) {
    logger.error('❌ Validation failed');
    logger.error(`Invalid packages: ${invalidPackages.join(', ')}`);
  } else {
    logger.success('✅ All packages are valid!');
  }

  // Set outputs
  core.setOutput('validated-packages', JSON.stringify(validPackages));
  core.setOutput('valid-count', validPackages.length);
  core.setOutput('invalid-count', invalidPackages.length);

  return {
    validPackages,
    invalidPackages,
    totalErrors,
    totalWarnings,
  };
}
