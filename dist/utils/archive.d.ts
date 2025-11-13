/**
 * Archive creation and manipulation utilities
 * Supports both tar.gz (for OCI) and ZIP (for artifacts)
 */
export type ArchiveFormat = 'tar.gz' | 'zip';
export declare function createTarGz(sourceDir: string, outputPath: string, baseName: string): Promise<void>;
export declare function createZip(sourceDir: string, outputPath: string, baseName: string): Promise<void>;
export declare function createArchive(sourceDir: string, outputPath: string, baseName: string, format: ArchiveFormat): Promise<void>;
export declare function extractTarGz(archivePath: string, extractTo: string, files?: string[]): Promise<void>;
export declare function listTarGzContents(archivePath: string): Promise<string[]>;
export declare function generateChecksum(filePath: string): Promise<string>;
export declare function verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean>;
export declare function saveChecksumFile(filePath: string, checksum: string): Promise<void>;
export declare function formatBytes(bytes: number): string;
export declare function parsePluginArchiveName(filename: string): {
    name: string;
    version: string;
} | null;
export declare function extractArchiveFiles(archivePath: string, extractTo: string, files: string[]): Promise<void>;
