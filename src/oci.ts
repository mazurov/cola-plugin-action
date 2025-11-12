import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from './utils/logger';
import { findPluginDirectories, readManifest, sanitizeName } from './utils/manifest';
import { createTarGz } from './utils/archive';

/**
 * Push plugins to OCI registry using ORAS
 */

export interface OCIPushOptions {
  pluginsDirectory: string;
  registry: string;
  username: string;
  token: string;
}

export interface OCIPushResult {
  pushedCount: number;
  skippedCount: number;
}

export async function pushToOCI(options: OCIPushOptions): Promise<OCIPushResult> {
  logger.header('Pushing Plugins to OCI Registry');

  const { pluginsDirectory, registry, username, token } = options;

  logger.info(`Registry: ${registry}`);
  logger.info(`Username: ${username}`);

  // Ensure ORAS is installed
  await ensureOrasInstalled();

  // Login to OCI registry
  await orasLogin(registry, username, token);

  // Find all plugin directories
  const pluginDirs = await findPluginDirectories(pluginsDirectory);

  if (pluginDirs.length === 0) {
    throw new Error(`No plugins found in ${pluginsDirectory}`);
  }

  logger.info(`Found ${pluginDirs.length} plugin(s) to push`);

  let pushedCount = 0;
  let skippedCount = 0;

  // Push each plugin
  for (const pluginDir of pluginDirs) {
    const pluginName = path.basename(pluginDir);

    logger.startGroup(`Processing: ${pluginName}`);

    try {
      // Read manifest
      const manifest = await readManifest(pluginDir);

      const commandName = manifest.cmds[0]?.name || manifest.pkgName;
      const safeName = sanitizeName(commandName);
      const ociRef = `${registry}/${safeName}`;
      const version = manifest.version;

      logger.info(`Package: ${manifest.pkgName}`);
      logger.info(`Version: ${version}`);
      logger.info(`Command: ${commandName}`);
      logger.info(`OCI Reference: ${ociRef}:${version}`);

      // Check if version already exists
      const exists = await checkOCITagExists(ociRef, version);

      if (exists) {
        logger.warning(`Version ${version} already exists in registry: ${ociRef}:${version}`);
        logger.warning('Skipping push (already published)');
        skippedCount++;
        continue;
      }

      logger.info(`Version ${version} not found in registry, will push...`);

      // Create temporary archive
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-push-'));
      const tempArchive = path.join(tempDir, 'plugin.tar.gz');

      try {
        await createTarGz(pluginDir, tempArchive, pluginName);

        // Push to OCI registry
        const annotations = [
          `org.opencontainers.image.title=${manifest.pkgName}`,
          `org.opencontainers.image.version=${version}`,
        ];

        if (manifest._metadata?.description) {
          annotations.push(`org.opencontainers.image.description=${manifest._metadata.description}`);
        }

        await orasPush(ociRef, version, tempArchive, annotations);

        // Tag as latest
        await orasTag(ociRef, version, 'latest');

        logger.success(`✅ Pushed: ${ociRef}:${version}`);
        logger.success(`✅ Tagged: ${ociRef}:latest`);

        pushedCount++;
      } finally {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error(
        `Failed to push ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
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
  logger.info('Note: Versions already in registry were skipped (not an error)');

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

  let osPlatform = platform;
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

  await exec.exec('oras', ['login', registry, '-u', username, '--password-stdin'], {
    input: Buffer.from(token),
    silent: true,
  });

  logger.success('Authentication successful');
}

async function orasLogout(registry: string): Promise<void> {
  await exec.exec('oras', ['logout', registry], { silent: true });
}

async function checkOCITagExists(ociRef: string, tag: string): Promise<boolean> {
  try {
    await exec.exec('oras', ['manifest', 'fetch', `${ociRef}:${tag}`], {
      silent: true,
      ignoreReturnCode: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function orasPush(
  ociRef: string,
  tag: string,
  archivePath: string,
  annotations: string[]
): Promise<void> {
  const args = [
    'push',
    `${ociRef}:${tag}`,
    `${archivePath}:application/vnd.oci.image.layer.v1.tar+gzip`,
  ];

  for (const annotation of annotations) {
    args.push('--annotation', annotation);
  }

  await exec.exec('oras', args);
}

async function orasTag(ociRef: string, sourceTag: string, targetTag: string): Promise<void> {
  await exec.exec('oras', ['tag', `${ociRef}:${sourceTag}`, targetTag]);
}
