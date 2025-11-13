import { PluginManifest, ValidationResult } from '../types/manifest';
/**
 * Manifest parsing and validation utilities
 */
export declare function readManifest(pluginDir: string): Promise<PluginManifest>;
export declare function validateManifest(manifest: PluginManifest): ValidationResult;
export declare function findPluginDirectories(pluginsDir: string): Promise<string[]>;
export declare function sanitizeName(name: string): string;
export declare function parsePluginArchiveName(filename: string): {
    name: string;
    version: string;
} | null;
