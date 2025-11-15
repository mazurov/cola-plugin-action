/**
 * Archive creation and manipulation utilities
 * Supports ZIP format for both artifacts and OCI registry
 */
export type ArchiveFormat = 'zip';
export declare function createZip(sourceDir: string, outputPath: string, _baseName: string): Promise<void>;
export declare function formatBytes(bytes: number): string;
export declare function parsePluginArchiveName(filename: string): {
    name: string;
    version: string;
} | null;
