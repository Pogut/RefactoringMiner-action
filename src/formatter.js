const COMMENT_HEADER = '### RefactoringMiner Report';

/**
 * Builds a markdown comment body from RefactoringMiner's JSON output.
 * @param {{ commits: Array<{ refactorings: Array<{ type: string, description: string }> }> }} data
 * @returns {string}
 */
function buildComment(data) {
  const all = data.commits.flatMap(c => c.refactorings);

  if (all.length === 0) {
    return `${COMMENT_HEADER}\nNo refactorings detected in this change.`;
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

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}`;
}

module.exports = { buildComment, COMMENT_HEADER };
