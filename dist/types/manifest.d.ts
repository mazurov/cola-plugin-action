/**
 * Command Launcher Plugin Manifest Types
 * Based on: https://criteo.github.io/command-launcher/docs/overview/manifest/
 */
export interface PluginCommand {
    name: string;
    type: 'executable' | 'alias' | 'group';
    short?: string;
    long?: string;
    executable?: string;
    args?: string[];
    subcommands?: PluginCommand[];
    env?: Record<string, string>;
    flags?: CommandFlag[];
}
export interface CommandFlag {
    name: string;
    short?: string;
    type: 'string' | 'bool' | 'int' | 'float';
    description?: string;
    required?: boolean;
    default?: string | boolean | number;
}
export interface PluginMetadata {
    author?: string;
    license?: string;
    homepage?: string;
    repository?: string;
    tags?: string[];
    description?: string;
}
export interface PluginManifest {
    pkgName: string;
    version: string;
    cmds: PluginCommand[];
    _metadata?: PluginMetadata;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface PackagedPlugin {
    name: string;
    version: string;
    archivePath: string;
    checksum: string;
    size: number;
}
