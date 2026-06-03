const COMMENT_HEADER = '### RefactoringMiner Report';

/**
 * Renders the optional "view the interactive diff" footer.
 * @param {{ url: string, kind: 'pages' | 'artifact' } | undefined} view
 * @returns {string}
 */
function viewFooter(view) {
  if (!view || !view.url) {
    return '';
  }
  if (view.kind === 'pages') {
    return `\n\n🔍 **[View the interactive diff](${view.url})** _(first run may take ~1 min to go live)_`;
  }
  return `\n\n📦 Interactive diff exported as a workflow artifact — [open the run](${view.url}), download \`refactoring-diff\`, and open \`web/list/index.html\`.`;
}

/**
 * Builds a markdown comment body from RefactoringMiner's JSON output.
 * @param {{ commits: Array<{ refactorings: Array<{ type: string, description: string }> }> }} data
 * @param {{ url: string, kind: 'pages' | 'artifact' }} [view] Optional interactive-view link.
 * @returns {string}
 */
function buildComment(data, view) {
  const all = data.commits.flatMap(c => c.refactorings);
  const footer = viewFooter(view);

  if (all.length === 0) {
    return `${COMMENT_HEADER}\nNo refactorings detected in this change.${footer}`;
  }

  const counts = all.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const breakdown = Object.entries(counts)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  const details = all
    .map(r => `- **${r.type}** — ${r.description}`)
    .join('\n');

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}${footer}`;
}

module.exports = { buildComment, COMMENT_HEADER };
