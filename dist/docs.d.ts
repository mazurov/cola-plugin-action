import { DocsGenerationOptions, DocsGenerationResult } from './types/docs';
/**
 * Generate GitHub Pages documentation from releases
 * Replaces generate-docs-from-releases.sh
 */
export declare function generateDocs(options: DocsGenerationOptions): Promise<DocsGenerationResult>;
