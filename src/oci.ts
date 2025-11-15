import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from './utils/logger';
import { sanitizeName } from './utils/manifest';

/**
 * Push plugins to OCI registry using ORAS
 */

export interface OCIPushOptions {
  outputDirectory: string; // Directory containing the generated ZIP files
  registry: string;
  username: string;
  token: string;
  forceRelease?: boolean; // Override existing OCI tags (force push)
}

export interface OCIPushResult {
  pushedCount: number;
  skippedCount: number;
}

export async function pushToOCI(options: OCIPushOptions): Promise<OCIPushResult> {
  logger.header('Pushing Packages to OCI Registry');

  const { outputDirectory, registry, username, token, forceRelease = false } = options;

  logger.info(`Output Directory: ${outputDirectory}`);
  logger.info(`Registry: ${registry}`);
  logger.info(`Username: ${username}`);

  // Ensure ORAS is installed
  await ensureOrasInstalled();

  // Login to OCI registry
  await orasLogin(registry, username, token);

  // Find all .pkg files in the output directory
  const files = await fs.readdir(outputDirectory);
  const pkgFiles = files.filter(file => file.endsWith('.pkg'));

  if (pkgFiles.length === 0) {
    throw new Error(`No .pkg files found in ${outputDirectory}`);
  }

  logger.info(`Found ${pkgFiles.length} .pkg file(s) to push`);

  let pushedCount = 0;
  let skippedCount = 0;

  // Push each .pkg file
  for (const pkgFile of pkgFiles) {
    const pkgPath = path.join(outputDirectory, pkgFile);

    logger.startGroup(`Processing: ${pkgFile}`);

    try {
      // Parse package name and version from filename: {pkgName}-{version}.pkg
      const match = pkgFile.match(/^(.+)-(\d+\.\d+\.\d+.*?)\.pkg$/);
      if (!match) {
        logger.warning(`Skipping ${pkgFile}: Invalid filename format (expected: name-version.pkg)`);
        skippedCount++;
        continue;
      }

      const [, pkgName, version] = match;
      const safeName = sanitizeName(pkgName);
      const ociRef = `${registry}/${safeName}`;

      logger.info(`Package: ${pkgName}`);
      logger.info(`Version: ${version}`);
      logger.info(`OCI Reference: ${ociRef}:${version}`);

      // Check if version already exists
      const exists = await checkOCITagExists(ociRef, version);

      if (exists) {
        if (forceRelease) {
          // Override existing OCI tag (force push)
          logger.warning(
            `Version ${version} already exists in registry, will override due to force-release`
          );
          logger.info(`Overriding: ${ociRef}:${version}`);
        } else {
          logger.warning(`Version ${version} already exists in registry: ${ociRef}:${version}`);
          logger.warning('Skipping push (already published)');
          skippedCount++;
          continue;
        }
      } else {
        logger.info(`Version ${version} not found in registry, will push...`);
      }

      // Push to OCI registry
      const annotations = [
        `org.opencontainers.image.title=${pkgName}`,
        `org.opencontainers.image.version=${version}`,
      ];

      await orasPush(ociRef, version, pkgPath, annotations);

      // Tag as latest
      await orasTag(ociRef, version, 'latest');

      logger.success(`✅ Pushed: ${ociRef}:${version}`);
      logger.success(`✅ Tagged: ${ociRef}:latest`);

      pushedCount++;
    } catch (error) {
      logger.error(
        `Failed to push ${pkgFile}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      logger.endGroup();
    }
  }

  // Logout
  await orasLogout(registry);

  // Summary
  logger.header('OCI Push Summary');
  logger.info(`Packages pushed: ${pushedCount}`);
  logger.info(`Packages skipped: ${skippedCount}`);
  logger.info(`Total processed: ${pushedCount + skippedCount}`);

  if (pushedCount === 0 && skippedCount === 0) {
    throw new Error('No packages were processed');
  }

  logger.success('✅ OCI push completed successfully');
  if (skippedCount > 0 && !forceRelease) {
    logger.info('Note: Versions already in registry were skipped (not an error)');
  }
  if (forceRelease && pushedCount > 0) {
    logger.info('Note: Existing versions were overridden due to force-release');
  }

  return { pushedCount, skippedCount };
}

async function ensureOrasInstalled(): Promise<void> {
  try {
    await exec.exec('oras', ['version'], { silent: true });
    logger.info('✓ ORAS is installed');
  } catch {
    logger.info('ORAS not found, installing...');
    await installOras();
  }
}

async function installOras(): Promise<void> {
  const platform = os.platform();
  const arch = os.arch();

  const osPlatform = platform;
  let osArch = arch;

  if (arch === 'x64') osArch = 'amd64';
  if (arch === 'arm64') osArch = 'arm64';

  const version = '1.1.0';
  const url = `https://github.com/oras-project/oras/releases/download/v${version}/oras_${version}_${osPlatform}_${osArch}.tar.gz`;

  logger.info(`Downloading ORAS from: ${url}`);

  await exec.exec('curl', ['-sLO', url]);
  await exec.exec('mkdir', ['-p', 'oras-install']);
  await exec.exec('tar', [
    '-xzf',
    `oras_${version}_${osPlatform}_${osArch}.tar.gz`,
    '-C',
    'oras-install',
  ]);
  await exec.exec('sudo', ['mv', 'oras-install/oras', '/usr/local/bin/']);
  await exec.exec('rm', ['-rf', 'oras-install', `oras_${version}_${osPlatform}_${osArch}.tar.gz`]);

  logger.success('ORAS installed successfully');
}

async function orasLogin(registry: string, username: string, token: string): Promise<void> {
  logger.info('Authenticating to OCI registry...');

  // Extract hostname from registry URL (e.g., "ghcr.io/username" -> "ghcr.io")
  const registryHostname = registry.split('/')[0];

  logger.info(`Command: oras login ${registryHostname} -u ${username} --password-stdin`);
  logger.info(`Token: ${token.substring(0, 4)}${'*'.repeat(token.length - 4)}`);

  await exec.exec('oras', ['login', registryHostname, '-u', username, '--password-stdin'], {
    input: Buffer.from(token),
    silent: true,
  });

  logger.success('Authentication successful');
}

async function orasLogout(registry: string): Promise<void> {
  // Extract hostname from registry URL (e.g., "ghcr.io/username" -> "ghcr.io")
  const registryHostname = registry.split('/')[0];
  await exec.exec('oras', ['logout', registryHostname], { silent: true });
}

async function checkOCITagExists(ociRef: string, tag: string): Promise<boolean> {
  logger.info(`Checking if OCI tag exists: ${ociRef}:${tag}`);

  try {
    let exitCode = -1;

    // Use ignoreReturnCode and silent to handle the command properly
    exitCode = await exec.exec('oras', ['manifest', 'fetch', `${ociRef}:${tag}`], {
      silent: true,
      ignoreReturnCode: true,
    });

    logger.info(`ORAS manifest fetch exit code: ${exitCode}`);

    // Return true only if the command succeeded (exit code 0)
    const exists = exitCode === 0;
    logger.info(`Tag ${ociRef}:${tag} ${exists ? 'EXISTS' : 'NOT FOUND'}`);

    return exists;
  } catch (error) {
    logger.error(
      `Error checking OCI tag existence: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

async function orasPush(
  ociRef: string,
  tag: string,
  pkgPath: string,
  annotations: string[]
): Promise<void> {
  const pkgDir = path.dirname(pkgPath);
  const pkgFileName = path.basename(pkgPath);

  const args = ['push', `${ociRef}:${tag}`, `${pkgFileName}:application/zip`];

  for (const annotation of annotations) {
    args.push('--annotation', annotation);
  }

  logger.info(`Command: oras ${args.join(' ')}`);
  logger.info(`Working directory: ${pkgDir}`);

  await exec.exec('oras', args, {
    cwd: pkgDir,
  });
}

async function orasTag(ociRef: string, sourceTag: string, targetTag: string): Promise<void> {
  logger.info(`Command: oras tag ${ociRef}:${sourceTag} ${targetTag}`);
  await exec.exec('oras', ['tag', `${ociRef}:${sourceTag}`, targetTag]);
}
