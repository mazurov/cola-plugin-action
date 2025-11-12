import { marked } from 'marked';
import { logger } from './logger';

/**
 * Markdown rendering utilities
 * Replaces pandoc with Node.js marked library
 */

// Configure marked for GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(markdown: string): string {
  try {
    const html = marked.parse(markdown);
    return typeof html === 'string' ? html : html.toString();
  } catch (error) {
    logger.error(
      `Failed to render markdown: ${error instanceof Error ? error.message : String(error)}`
    );
    // Fallback: return wrapped in <pre> tags
    return `<pre>${escapeHtml(markdown)}</pre>`;
  }
}

export function renderMarkdownSafe(markdown: string): string {
  const html = renderMarkdown(markdown);
  return sanitizeHtml(html);
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export function sanitizeHtml(html: string): string {
  // Basic sanitization - remove script tags and inline event handlers
  let sanitized = html;

  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove inline event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}

export function extractTitle(markdown: string): string | null {
  // Try to find first H1 heading
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Try to find any heading
  const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  return null;
}

export function truncateMarkdown(markdown: string, maxLength: number): string {
  if (markdown.length <= maxLength) {
    return markdown;
  }

  // Try to truncate at sentence boundary
  const truncated = markdown.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > maxLength * 0.8) {
    return `${truncated.substring(0, breakPoint + 1)}...`;
  }

  return `${truncated}...`;
}
