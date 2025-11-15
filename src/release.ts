import * as github from '@actions/github';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger';
import { PackagedPackage } from './types/manifest';

/**
 * GitHub Release Management
 * Creates individual releases for each plugin version
 * Each release tag points to the current commit
 */

export interface ReleaseOptions {
  packages: PackagedPackage[];
  githubToken: string;
  repository: string; // format: "owner/repo"
  forceRelease?: boolean; // Delete existing releases and tags before creating new ones
}

export interface ReleaseResult {
  createdReleases: string[];
  skippedReleases: string[];
  deletedReleases: string[];
}

export async function createPluginReleases(options: ReleaseOptions): Promise<ReleaseResult> {
  logger.header('Creating GitHub Releases for Plugins');

  const { packages, githubToken, repository, forceRelease = false } = options;

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repository}. Expected: owner/repo`);
  }

  const octokit = github.getOctokit(githubToken);

  const createdReleases: string[] = [];
  const skippedReleases: string[] = [];
  const deletedReleases: string[] = [];

  // Get current git remote URL
  const remoteUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`;

  for (const pkg of packages) {
    const tagName = `${pkg.name}-${pkg.version}`;
    const releaseName = `${pkg.name} v${pkg.version}`;

    logger.startGroup(`Processing: ${tagName}`);

    try {
      // Check if tag already exists
      const tagExists = await checkTagExists(octokit, owner, repo, tagName);

      if (tagExists) {
        if (forceRelease) {
          // Delete existing release and tag
          logger.warning(`Tag ${tagName} already exists, deleting due to force-release`);
          await deleteExistingRelease(octokit, owner, repo, tagName, remoteUrl);
          deletedReleases.push(tagName);
        } else {
          logger.warning(`Tag ${tagName} already exists, skipping`);
          skippedReleases.push(tagName);
          logger.endGroup();
          continue;
        }
      }

      // Create git tag on current commit
      logger.info(`Creating tag: ${tagName}`);
      await exec.exec('git', ['tag', tagName]);
      await exec.exec('git', ['push', remoteUrl, tagName]);
      logger.success(`✅ Tag ${tagName} created and pushed`);

      // Read package file for release asset
      const packageFileName = path.basename(pkg.archivePath);
      const packageContent = await fs.readFile(pkg.archivePath);

      logger.info(`Creating GitHub release: ${tagName}`);

      // Create release
      const release = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tagName,
        name: releaseName,
        body: generateReleaseNotes(pkg),
        draft: false,
        prerelease: false,
      });

      logger.info(`Release created: ${release.data.html_url}`);

      // Upload package asset
      await octokit.rest.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: release.data.id,
        name: packageFileName,
        data: packageContent as unknown as string,
      });

      logger.success(`✅ Release created: ${tagName}`);
      logger.info(`   URL: ${release.data.html_url}`);
      createdReleases.push(tagName);
    } catch (error) {
      logger.error(
        `Failed to create release for ${tagName}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      logger.endGroup();
    }
  }

  // Summary
  logger.header('Release Creation Summary');
  logger.info(`Releases created: ${createdReleases.length}`);
  logger.info(`Releases skipped: ${skippedReleases.length}`);
  logger.info(`Releases deleted: ${deletedReleases.length}`);
  logger.info(`Total processed: ${packages.length}`);

  if (deletedReleases.length > 0) {
    logger.warning('Deleted releases (force-release):');
    for (const tag of deletedReleases) {
      logger.info(`  - ${tag}`);
    }
  }

  if (createdReleases.length > 0) {
    logger.success('Created releases:');
    for (const tag of createdReleases) {
      logger.info(`  - ${tag}`);
    }
  }

  if (skippedReleases.length > 0) {
    logger.info('Skipped releases (already exist):');
    for (const tag of skippedReleases) {
      logger.info(`  - ${tag}`);
    }
  }

  return { createdReleases, skippedReleases, deletedReleases };
}

async function checkTagExists(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  tagName: string
): Promise<boolean> {
  try {
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `tags/${tagName}`,
    });
    return true;
  } catch (error) {
    // If error is 404, tag doesn't exist
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

async function deleteExistingRelease(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  tagName: string,
  remoteUrl: string
): Promise<void> {
  try {
    // 1. Try to find and delete the GitHub release
    try {
      const release = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag: tagName,
      });

      logger.info(`  Deleting GitHub release: ${tagName}`);
      await octokit.rest.repos.deleteRelease({
        owner,
        repo,
        release_id: release.data.id,
      });
      logger.success(`  ✅ GitHub release deleted`);
    } catch (error) {
      // If release doesn't exist (404), that's fine
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        logger.info(`  No GitHub release found for ${tagName}`);
      } else {
        throw error;
      }
    }

    // 2. Delete the git tag locally (if exists)
    logger.info(`  Deleting local tag: ${tagName}`);
    try {
      await exec.exec('git', ['tag', '-d', tagName], { ignoreReturnCode: true });
    } catch {
      // Ignore errors - tag might not exist locally
    }

    // 3. Delete the git tag from remote
    logger.info(`  Deleting remote tag: ${tagName}`);
    try {
      await exec.exec('git', ['push', remoteUrl, `:refs/tags/${tagName}`], {
        ignoreReturnCode: true,
      });
      logger.success(`  ✅ Remote tag deleted`);
    } catch (error) {
      logger.warning(`  Failed to delete remote tag (may not exist): ${tagName}`);
    }
  } catch (error) {
    logger.error(
      `Failed to delete release ${tagName}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

function generateReleaseNotes(pkg: PackagedPackage): string {
  return `# ${pkg.name} v${pkg.version}

## 📦 Installation

Download the \`.pkg\` file below and extract it to your Command Launcher plugins directory:

\`\`\`bash
# Download and extract (.pkg files are ZIP archives)
unzip ${pkg.name}-${pkg.version}.pkg -d ~/.command-launcher/plugins/
\`\`\`

## 📄 Package Information

- **Name:** ${pkg.name}
- **Version:** ${pkg.version}
- **Size:** ${formatBytes(pkg.size)}

---

🤖 *Generated automatically by [Cola Plugin Action](https://github.com/criteo/cola-plugin-action)*
`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
