/**
 * Documentation generation types
 */
export interface VersionInfo {
    version: string;
    isLatest: boolean;
}
export interface PluginVersions {
    pluginName: string;
    versions: VersionInfo[];
    latestVersion: string;
}
export interface AllVersionsMetadata {
    plugins: Record<string, string[]>;
    generated: string;
}
export interface PluginDocumentation {
    pluginName: string;
    version: string;
    manifest: {
        pkgName: string;
        version: string;
        description?: string;
        author?: string;
        license?: string;
        homepage?: string;
        repository?: string;
        tags?: string[];
        commandName?: string;
        commandType?: string;
    };
    readme: string;
    readmeHtml: string;
    archiveUrl: string;
    archiveSize: number;
    checksum?: string;
}
export interface DocsGenerationOptions {
    repository: string;
    githubToken: string;
    docsBranch: string;
    keepVersions: number;
    templatePath: string;
}
export interface DocsGenerationResult {
    pluginsProcessed: number;
    versionsGenerated: number;
    docsUrl: string;
}
export interface TemplateVariables {
    [key: string]: string | number | boolean | undefined;
}
//# sourceMappingURL=docs.d.ts.map