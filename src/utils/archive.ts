import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import tar from 'tar';
import { logger } from './logger';

/**
 * Archive creation and manipulation utilities
 * Supports both tar.gz (for OCI) and ZIP (for artifacts)
 */

export type ArchiveFormat = 'tar.gz' | 'zip';

export async function createTarGz(
  sourceDir: string,
  outputPath: string,
  baseName: string
): Promise<void> {
  logger.info(`Creating tar.gz archive: ${outputPath}`);

  try {
    const tempDir = await fs.mkdtemp(path.join(path.dirname(outputPath), 'tar-temp-'));
    const tempBasePath = path.join(tempDir, baseName);

    try {
      // Create temporary directory with the desired base name
      await fs.mkdir(tempBasePath, { recursive: true });

      // Copy all contents from source to temp directory
      const items = await fs.readdir(sourceDir);
      for (const item of items) {
        const srcPath = path.join(sourceDir, item);
        const destPath = path.join(tempBasePath, item);

        const stats = await fs.stat(srcPath);
        if (stats.isDirectory()) {
          await fs.cp(srcPath, destPath, { recursive: true });
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }

      // Create tar.gz from the temporary structure
      await tar.create(
        {
          gzip: true,
          file: outputPath,
          cwd: tempDir,
        },
        [baseName]
      );
    } finally {
      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    const stats = await fs.stat(outputPath);
    logger.success(`Created tar.gz archive: ${outputPath} (${formatBytes(stats.size)})`);
  } catch (error) {
    throw new Error(
      `Failed to create tar.gz archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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

export async function createArchive(
  sourceDir: string,
  outputPath: string,
  baseName: string,
  format: ArchiveFormat
): Promise<void> {
  if (format === 'tar.gz') {
    await createTarGz(sourceDir, outputPath, baseName);
  } else {
    await createZip(sourceDir, outputPath, baseName);
  }
}

export async function extractTarGz(
  archivePath: string,
  extractTo: string,
  files?: string[]
): Promise<void> {
  logger.info(`Extracting archive: ${archivePath}`);

  try {
    await tar.extract({
      file: archivePath,
      cwd: extractTo,
      filter: files ? (filePath: string) => files.includes(filePath) : undefined,
    });

    logger.success(`Extracted to: ${extractTo}`);
  } catch (error) {
    throw new Error(
      `Failed to extract archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function listTarGzContents(archivePath: string): Promise<string[]> {
  const files: string[] = [];

  await tar.list({
    file: archivePath,
    onentry: entry => files.push(entry.path),
  });

  return files;
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
  const basename = filename.replace('.tar.gz', '');

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

export async function extractArchiveFiles(
  archivePath: string,
  extractTo: string,
  files: string[]
): Promise<void> {
  logger.info(`Extracting specific files from: ${archivePath}`);

  try {
    await fs.mkdir(extractTo, { recursive: true });

    await tar.extract({
      file: archivePath,
      cwd: extractTo,
      filter: (filePath: string) => {
        // Check if any requested file matches this path
        return files.some(
          requestedFile => filePath.includes(requestedFile) || filePath.endsWith(requestedFile)
        );
      },
    });

    logger.success(`Extracted files to: ${extractTo}`);
  } catch (error) {
    throw new Error(
      `Failed to extract files from archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
