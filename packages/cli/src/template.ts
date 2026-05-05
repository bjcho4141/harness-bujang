/**
 * Replace `{{KEY}}` placeholders in `content` using the lookup table.
 *
 * Unknown keys are left intact so the user can spot what wasn't filled.
 * Whitespace inside the braces is tolerated: `{{ KEY }}` works the same as
 * `{{KEY}}`.
 */
export function renderTemplate(
  content: string,
  context: Record<string, string>,
): string {
  return content.replace(/\{\{\s*([A-Z_][A-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    if (key in context && context[key] !== undefined && context[key] !== '') {
      return context[key];
    }
    return match;
  });
}

/**
 * Count unfilled `{{...}}` placeholders in a rendered string. Used by the
 * status command to flag incomplete installs.
 */
export function countUnfilled(rendered: string): number {
  return (rendered.match(/\{\{\s*[A-Z_][A-Z0-9_]*\s*\}\}/g) ?? []).length;
}
