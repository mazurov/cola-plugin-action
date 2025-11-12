import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger';
import { findPluginDirectories, readManifest } from './utils/manifest';
import {
  createTarGz,
  generateChecksum,
  saveChecksumFile,
  formatBytes,
} from './utils/archive';
import { PackagedPlugin } from './types/manifest';

/**
 * Package plugins into tar.gz archives
 */

export interface PackageOptions {
  pluginsDirectory: string;
  outputDirectory: string;
}

export interface PackageResult {
  packages: PackagedPlugin[];
}

export async function packagePlugins(options: PackageOptions): Promise<PackageResult> {
  logger.header('Packaging Plugins');

  const { pluginsDirectory, outputDirectory } = options;

  logger.info(`Plugins directory: ${pluginsDirectory}`);
  logger.info(`Output directory: ${outputDirectory}`);

  // Ensure output directory exists
  await fs.mkdir(outputDirectory, { recursive: true });

  // Find all plugin directories
  const pluginDirs = await findPluginDirectories(pluginsDirectory);

  if (pluginDirs.length === 0) {
    throw new Error(`No plugins found in ${pluginsDirectory}`);
  }

  logger.info(`Found ${pluginDirs.length} plugin(s) to package`);

  const packages: PackagedPlugin[] = [];

  // Package each plugin
  for (const pluginDir of pluginDirs) {
    const pluginName = path.basename(pluginDir);

    logger.startGroup(`Packaging: ${pluginName}`);

    try {
      // Read manifest to get version
      const manifest = await readManifest(pluginDir);

      logger.info(`Package: ${manifest.pkgName}`);
      logger.info(`Version: ${manifest.version}`);

      // Create archive name: {pkgName}-{version}.tar.gz
      const archiveName = `${manifest.pkgName}-${manifest.version}.tar.gz`;
      const archivePath = path.join(outputDirectory, archiveName);

      // Create tar.gz archive
      await createTarGz(pluginDir, archivePath, pluginName);

      // Generate checksum
      const checksum = await generateChecksum(archivePath);
      await saveChecksumFile(archivePath, checksum);

      // Get file size
      const stats = await fs.stat(archivePath);

      logger.success(`✅ Packaged: ${archiveName}`);
      logger.info(`   Size: ${formatBytes(stats.size)}`);
      logger.info(`   SHA256: ${checksum}`);

      packages.push({
        name: manifest.pkgName,
        version: manifest.version,
        archivePath,
        checksum,
        size: stats.size,
      });
    } catch (error) {
      logger.error(
        `Failed to package ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      logger.endGroup();
    }
  }

  // Summary
  logger.header('Packaging Summary');
  logger.info(`Total packages created: ${packages.length}`);

  const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);
  logger.info(`Total size: ${formatBytes(totalSize)}`);

  // Set outputs
  const artifactsList = packages.map(pkg => ({
    name: pkg.name,
    version: pkg.version,
    archive: path.basename(pkg.archivePath),
    checksum: pkg.checksum,
    size: pkg.size,
  }));

  core.setOutput('packaged-artifacts', JSON.stringify(artifactsList));
  core.setOutput('package-count', packages.length);

  return { packages };
}
