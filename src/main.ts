import * as core from '@actions/core';
import * as path from 'path';
import { logger } from './utils/logger';
import { validatePlugins } from './validate';
import { packagePlugins } from './package';
import { pushToOCI } from './oci';
import { generateDocs as generateDocumentation } from './docs';

/**
 * Main entry point for the Cola Plugin Action
 */

async function run(): Promise<void> {
  try {
    // Get inputs
    const pluginsDirectory = core.getInput('plugins-directory', { required: true });
    const validateOnly = core.getInput('validate-only') === 'true';
    const packageFormat = core.getInput('package-format') || 'tar.gz';
    const ociRegistry = core.getInput('oci-registry');
    const ociUsername = core.getInput('oci-username');
    const ociToken = core.getInput('oci-token');
    const generateDocs = core.getInput('generate-docs') === 'true';

    logger.header('Cola Plugin Action');
    logger.info(`Plugins Directory: ${pluginsDirectory}`);
    logger.info(`Validate Only: ${validateOnly}`);
    logger.info(`Package Format: ${packageFormat}`);
    logger.info(`Generate Docs: ${generateDocs}`);

    // Step 1: Validate manifests
    const validateResult = await validatePlugins({
      pluginsDirectory,
    });

    if (validateResult.invalidPlugins.length > 0) {
      throw new Error(
        `Validation failed for ${validateResult.invalidPlugins.length} plugin(s): ${validateResult.invalidPlugins.join(', ')}`
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

    if (packageFormat === 'tar.gz' || packageFormat === 'both') {
      await packagePlugins({
        pluginsDirectory,
        outputDirectory,
      });
      packagesCreated = true;
    }

    // Step 3: Push to OCI registry
    if ((packageFormat === 'oci' || packageFormat === 'both') && ociRegistry) {
      if (!ociUsername || !ociToken) {
        throw new Error('OCI registry credentials required (oci-username and oci-token)');
      }

      await pushToOCI({
        pluginsDirectory,
        registry: ociRegistry,
        username: ociUsername,
        token: ociToken,
      });
    }

    // Step 4: Generate documentation
    if (generateDocs) {
      const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
      const githubRepository = process.env.GITHUB_REPOSITORY;
      const docsBranch = core.getInput('docs-branch') || 'gh-pages';
      const docsKeepVersions = parseInt(core.getInput('docs-keep-versions') || '0', 10);
      const actionPath = process.env.GITHUB_ACTION_PATH || process.cwd();
      const templatePath = path.join(actionPath, 'templates', 'plugin-page.html');

      if (!githubToken || !githubRepository) {
        logger.warning('Skipping documentation generation - GitHub token or repository not available');
      } else {
        await generateDocumentation({
          repository: githubRepository,
          githubToken,
          docsBranch,
          keepVersions: docsKeepVersions,
          templatePath,
        });
      }
    }

    // Final summary
    logger.header('Action Complete');
    logger.success('✅ All steps completed successfully');

    if (packagesCreated) {
      logger.info(`📦 Packages created in: ${outputDirectory}`);
    }

    if (packageFormat === 'oci' || packageFormat === 'both') {
      logger.info(`🚀 Plugins pushed to OCI registry: ${ociRegistry}`);
    }

    if (generateDocs) {
      logger.info('📚 Documentation published to GitHub Pages');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    core.setFailed(message);
  }
}

// Run the action
run();
