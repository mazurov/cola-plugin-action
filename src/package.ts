import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger';
import { findPackageDirectories, readManifest } from './utils/manifest';
import {
  createZip,
  generateChecksum,
  saveChecksumFile,
  formatBytes,
  ArchiveFormat,
} from './utils/archive';
import { PackagedPackage } from './types/manifest';

/**
 * Create packages archives (ZIP format)
 */

export interface PackageOptions {
  packagesDirectory: string;
  outputDirectory: string;
  format?: ArchiveFormat;
}

export interface PackageResult {
  packages: PackagedPackage[];
}

export async function createPackages(options: PackageOptions): Promise<PackageResult> {
  logger.header('Creating Packages');

  const { packagesDirectory, outputDirectory, format = 'zip' } = options;

  logger.info(`Packages directory: ${packagesDirectory}`);
  logger.info(`Output directory: ${outputDirectory}`);
  logger.info(`Archive format: ${format}`);

  // Ensure output directory exists
  await fs.mkdir(outputDirectory, { recursive: true });

  // Find all package directories
  const packageDirs = await findPackageDirectories(packagesDirectory);

  if (packageDirs.length === 0) {
    throw new Error(`No packages found in ${packagesDirectory}`);
  }

  logger.info(`Found ${packageDirs.length} package(s) to create`);

  const packages: PackagedPackage[] = [];

  // Create each package
  for (const packageDir of packageDirs) {
    const packageName = path.basename(packageDir);

    logger.startGroup(`Creating package: ${packageName}`);

    try {
      // Read manifest to get version
      const manifest = await readManifest(packageDir);

      logger.info(`Package: ${manifest.pkgName}`);
      logger.info(`Version: ${manifest.version}`);

      // Create archive name: {pkgName}-{version}.zip
      const archiveName = `${manifest.pkgName}-${manifest.version}.zip`;
      const archivePath = path.join(outputDirectory, archiveName);

      // Create ZIP archive
      await createZip(packageDir, archivePath, packageName);

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
        `Failed to create package ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      logger.endGroup();
    }
  }

  // Summary
  logger.header('Package Creation Summary');
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
