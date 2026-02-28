import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates directory relative to this file
const TEMPLATES_DIR = join(__dirname, '../../../templates/emails');

/**
 * Load and render an email template
 * 
 * @param templateName - Name of the template directory (e.g., 'invitation')
 * @param variables - Variables to substitute in the template
 * @returns Email subject and body (HTML if available, otherwise plain text) with variables replaced
 */
export async function loadEmailTemplate(
  templateName: string,
  variables: Record<string, string | null | undefined>,
): Promise<{ subject: string; body: string }> {
  const templatePath = join(TEMPLATES_DIR, templateName);

  // Loading email template files

  // Load template files (prefer HTML over plain text)
  const subject = await readFile(join(templatePath, 'subject.txt'), 'utf-8');
  
  let body: string;
  let bodyFormat: 'html' | 'text';
  try {
    // Try to load HTML template first
    body = await readFile(join(templatePath, 'body.html'), 'utf-8');
    bodyFormat = 'html';
  } catch {
    // Fall back to plain text template
    body = await readFile(join(templatePath, 'body.txt'), 'utf-8');
    bodyFormat = 'text';
  }

  // Template files loaded successfully

  // Simple template engine: replace {{variable}} with values
  const render = (content: string): string => {
    let rendered = content;
    
    // Replace {{variable}} with actual values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value ?? '');
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    // Remove blocks where variable is null/undefined/empty
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_, varName, content) => {
      const varValue = variables[varName];
      return varValue ? content : '';
    });

    return rendered.trim();
  };

  return {
    subject: render(subject),
    body: render(body),
  };
}
