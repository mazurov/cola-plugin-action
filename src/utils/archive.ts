import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger';

/**
 * Archive creation and manipulation utilities
 * Supports ZIP format for both artifacts and OCI registry
 */

export type ArchiveFormat = 'zip';

export async function createZip(
  sourceDir: string,
  outputPath: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _baseName: string // Kept for signature consistency with createTarGz, but not used for flat ZIP structure
): Promise<void> {
  logger.info(`Creating ZIP archive: ${outputPath}`);

  try {
    const { exec } = await import('@actions/exec');
    const absOutputPath = path.resolve(outputPath);

    // Create zip with contents directly (no root directory wrapper)
    // Using -j option would flatten, but we want to preserve subdirectory structure
    // So we cd into the source directory and zip everything with relative paths
    await exec('zip', ['-r', '-q', absOutputPath, '.'], {
      cwd: sourceDir,
    });

    const stats = await fs.stat(outputPath);
    logger.success(`Created ZIP archive: ${outputPath} (${formatBytes(stats.size)})`);
  } catch (error) {
    throw new Error(
      `Failed to create ZIP archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function generateChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const fileBuffer = await fs.readFile(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

export async function verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
  const actualChecksum = await generateChecksum(filePath);
  return actualChecksum === expectedChecksum;
}

export async function saveChecksumFile(filePath: string, checksum: string): Promise<void> {
  const checksumPath = `${filePath}.sha256`;
  const content = `${checksum}  ${path.basename(filePath)}\n`;
  await fs.writeFile(checksumPath, content, 'utf-8');
  logger.success(`Checksum saved to: ${checksumPath}`);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function parsePluginArchiveName(filename: string): { name: string; version: string } | null {
  const basename = filename.replace('.zip', '');

  // Match pattern: plugin-name-version
  const match = basename.match(/^(.+)-(\d+\.\d+\.\d+.*)$/);

  if (match) {
    return {
      name: match[1],
      version: match[2],
    };
  }

  return null;
}
