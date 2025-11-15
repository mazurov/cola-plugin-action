/**
 * Command Launcher Package Manifest Types
 * Based on: https://criteo.github.io/command-launcher/docs/overview/manifest/
 */

export interface PackageCommand {
  name: string;
  type: 'executable' | 'alias' | 'group';
  short?: string;
  long?: string;
  executable?: string;
  args?: string[];
  subcommands?: PackageCommand[];
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

export interface PackageMetadata {
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  tags?: string[];
  description?: string;
}

export interface PackageManifest {
  pkgName: string;
  version: string;
  cmds: PackageCommand[];
  _metadata?: PackageMetadata;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PackagedPackage {
  name: string;
  version: string;
  archivePath: string;
  size: number;
  sourceDirectory: string; // Path to the original plugin directory
}
