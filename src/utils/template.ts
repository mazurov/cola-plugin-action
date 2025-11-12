import * as fs from 'fs/promises';
import { TemplateVariables } from '../types/docs';
import { escapeHtml } from './markdown';

/**
 * Simple template engine for HTML generation
 * Replaces bash template_replace function
 */

export async function loadTemplate(templatePath: string): Promise<string> {
  return await fs.readFile(templatePath, 'utf-8');
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  let rendered = template;

  // Replace {{VARIABLE}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const safeValue = value !== undefined && value !== null ? String(value) : '';

    // Replace all occurrences
    rendered = rendered.split(placeholder).join(safeValue);
  }

  // Check for unreplaced variables (helpful for debugging)
  const unreplaced = rendered.match(/\{\{([A-Z_]+)\}\}/g);
  if (unreplaced) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: Unreplaced template variables: ${unreplaced.join(', ')}`);
  }

  return rendered;
}

export async function renderTemplateFile(
  templatePath: string,
  variables: TemplateVariables
): Promise<string> {
  const template = await loadTemplate(templatePath);
  return renderTemplate(template, variables);
}

export function createVersionSelectorHtml(
  pluginName: string,
  versions: string[],
  currentVersion: string
): string {
  const options = versions
    .map(version => {
      const selected = version === currentVersion ? ' selected' : '';
      return `      <option value="${version}"${selected}>${version}</option>`;
    })
    .join('\n');

  return `
    <div class="version-selector">
      <label for="version-select">Version:</label>
      <select id="version-select" onchange="window.location.href='/plugins/${escapeHtml(pluginName)}/' + this.value + '/index.html'">
${options}
      </select>
    </div>`;
}

export function createPluginCardHtml(plugin: {
  name: string;
  version: string;
  description?: string;
  tags?: string[];
}): string {
  const description = plugin.description
    ? `<p class="description">${escapeHtml(plugin.description)}</p>`
    : '';

  const tags =
    plugin.tags && plugin.tags.length > 0
      ? `<div class="tags">${plugin.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

  return `
    <div class="plugin-card">
      <h3><a href="${escapeHtml(plugin.name)}/index.html">${escapeHtml(plugin.name)}</a></h3>
      <span class="version">v${escapeHtml(plugin.version)}</span>
      ${description}
      ${tags}
    </div>`;
}

export function generateIndexHtml(
  plugins: {
    name: string;
    version: string;
    description?: string;
    tags?: string[];
  }[]
): string {
  const pluginCards = plugins.map(plugin => createPluginCardHtml(plugin)).join('\n');

  const timestamp = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Command Launcher Plugins</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 3rem 0;
      margin-bottom: 3rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    .plugins-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }
    .plugin-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .plugin-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .plugin-card h3 {
      margin-bottom: 0.5rem;
      color: #667eea;
    }
    .plugin-card h3 a {
      color: inherit;
      text-decoration: none;
    }
    .plugin-card h3 a:hover {
      text-decoration: underline;
    }
    .version {
      display: inline-block;
      background: #e0e7ff;
      color: #667eea;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .description {
      color: #666;
      margin: 1rem 0;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .tag {
      background: #f3f4f6;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
      color: #666;
    }
    footer {
      text-align: center;
      padding: 2rem 0;
      color: #666;
      border-top: 1px solid #ddd;
      margin-top: 3rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>Command Launcher Plugins</h1>
      <p>Extensible command-line tools for your workflow</p>
    </div>
  </header>
  <div class="container">
    <div class="plugins-grid">
      ${pluginCards}
    </div>
  </div>
  <footer>
    <div class="container">
      <p>Generated on ${new Date(timestamp).toLocaleString()}</p>
      <p>Powered by <a href="https://github.com/criteo/cola-plugin-action" target="_blank">Cola Plugin Action</a></p>
    </div>
  </footer>
</body>
</html>`;
}
