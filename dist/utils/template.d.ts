import { TemplateVariables } from '../types/docs';
/**
 * Simple template engine for HTML generation
 * Replaces bash template_replace function
 */
export declare function loadTemplate(templatePath: string): Promise<string>;
export declare function renderTemplate(template: string, variables: TemplateVariables): string;
export declare function renderTemplateFile(templatePath: string, variables: TemplateVariables): Promise<string>;
export declare function createVersionSelectorHtml(pluginName: string, versions: string[], currentVersion: string): string;
export declare function createPluginCardHtml(plugin: {
    name: string;
    version: string;
    description?: string;
    tags?: string[];
}): string;
export declare function generateIndexHtml(plugins: {
    name: string;
    version: string;
    description?: string;
    tags?: string[];
}[]): string;
//# sourceMappingURL=template.d.ts.map