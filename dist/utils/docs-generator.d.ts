import { PluginManifest } from '../types/manifest';
/**
 * Shared documentation generation utilities
 * Used by both production (src/docs.ts) and testing (scripts/test-docs-standalone.js)
 */
export declare function escapeHtml(text: string | undefined): string;
export declare function generateMetadataItems(manifest: PluginManifest): string;
export declare function generateCommandsSection(manifest: PluginManifest): string;
export declare function generateVersionSelector(versions: string[], currentVersion: string, style?: string): string;
export interface TemplateVariables {
    PLUGIN_NAME: string;
    VERSION: string;
    PLUGIN_VERSION: string;
    COMMAND_NAME: string;
    VERSION_SELECTOR: string;
    METADATA_ITEMS: string;
    COMMANDS_SECTION: string;
    README_CONTENT: string;
    [key: string]: string;
}
export declare function generateTemplateVariables(manifest: PluginManifest, version: string, readmeHtml: string, versionSelector: string): TemplateVariables;
export declare function generateVersionIndexPage(outputPath: string, pluginName: string, versions: string[], templatePath?: string): Promise<void>;
export declare function generateRedirectPage(outputPath: string, pluginName: string, latestVersion: string): Promise<void>;
//# sourceMappingURL=docs-generator.d.ts.map