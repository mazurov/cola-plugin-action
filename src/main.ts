import * as core from '@actions/core';
import { logger } from './utils/logger';
import { validatePackages } from './validate';
import { createPackages } from './package';
import { pushToOCI } from './oci';

/**
 * Main entry point for the Cola Plugin Action
 */

async function run(): Promise<void> {
  try {
    // Get inputs
    const packagesDirectory = core.getInput('packages-directory', { required: true });
    const validateOnly = core.getInput('validate-only') === 'true';
    const packageFormat = core.getInput('package-format') || 'zip';
    const ociRegistry = core.getInput('oci-registry');
    const ociUsername = core.getInput('oci-username');
    const ociToken = core.getInput('oci-token');

    logger.header('Cola Plugin Action');
    logger.info(`Packages Directory: ${packagesDirectory}`);
    logger.info(`Validate Only: ${validateOnly}`);
    logger.info(`Package Format: ${packageFormat}`);

    // Step 1: Validate manifests
    const validateResult = await validatePackages({
      packagesDirectory,
    });

    if (validateResult.invalidPackages.length > 0) {
      throw new Error(
        `Validation failed for ${validateResult.invalidPackages.length} package(s): ${validateResult.invalidPackages.join(', ')}`
      );
    }

    // If validate-only mode, stop here
    if (validateOnly) {
      logger.success('✅ Validation complete (validate-only mode)');
      return;
    }

    // Step 2: Package plugins
    let packagesCreated = false;
    const outputDirectory = 'build/packages';

    // Determine what to create based on package format
    // Note: tar.gz is created automatically when pushing to OCI registry
    const needsZipPackages = packageFormat === 'zip' || packageFormat === 'both';
    const needsOciPush = (packageFormat === 'oci' || packageFormat === 'both') && ociRegistry;

    // Create ZIP archives for GitHub Releases/Artifacts (cross-platform compatibility)
    if (needsZipPackages) {
      await createPackages({
        packagesDirectory,
        outputDirectory,
        format: 'zip',
      });
      packagesCreated = true;
    }

    // Step 3: Push to OCI registry (creates tar.gz internally)
    if (needsOciPush) {
      if (!ociUsername || !ociToken) {
        throw new Error('OCI registry credentials required (oci-username and oci-token)');
      }

      await pushToOCI({
        packagesDirectory,
        registry: ociRegistry,
        username: ociUsername,
        token: ociToken,
      });
    }

    // Final summary
    logger.header('Action Complete');
    logger.success('✅ All steps completed successfully');

    if (packagesCreated) {
      logger.info(`📦 Packages created in: ${outputDirectory}`);
    }

    if (needsOciPush) {
      logger.info(`🚀 Plugins pushed to OCI registry: ${ociRegistry}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    core.setFailed(message);
  }
}

// Run the action
run();
