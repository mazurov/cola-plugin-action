import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger';
import { findPluginDirectories, readManifest } from './utils/manifest';
import {
  createArchive,
  generateChecksum,
  saveChecksumFile,
  formatBytes,
  ArchiveFormat,
} from './utils/archive';
import { PackagedPlugin } from './types/manifest';

/**
 * Package plugins into archives (ZIP or tar.gz)
 */

export interface PackageOptions {
  pluginsDirectory: string;
  outputDirectory: string;
  format?: ArchiveFormat;
}

export interface PackageResult {
  packages: PackagedPlugin[];
}

export async function packagePlugins(options: PackageOptions): Promise<PackageResult> {
  logger.header('Packaging Plugins');

  const { pluginsDirectory, outputDirectory, format = 'zip' } = options;

  logger.info(`Plugins directory: ${pluginsDirectory}`);
  logger.info(`Output directory: ${outputDirectory}`);
  logger.info(`Archive format: ${format}`);

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

      // Create archive name: {pkgName}-{version}.{format}
      const extension = format === 'tar.gz' ? '.tar.gz' : '.zip';
      const archiveName = `${manifest.pkgName}-${manifest.version}${extension}`;
      const archivePath = path.join(outputDirectory, archiveName);

      // Create archive
      await createArchive(pluginDir, archivePath, pluginName, format);

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
