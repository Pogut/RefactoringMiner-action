const crypto = require('crypto');

const COMMENT_HEADER = '### RefactoringMiner Report';

/**
 * GitHub's per-file diff anchor is `diff-<hex(sha256(pathRelativeToRepoRoot))>`,
 * with no prefix/suffix and no trailing newline. Root files are hashed too:
 * `CustomerProfile.java` -> sha256("CustomerProfile.java"), not the literal name.
 * @param {string} filePath repo-root-relative path
 * @returns {string}
 */
function fileAnchor(filePath) {
  return 'diff-' + crypto.createHash('sha256').update(filePath, 'utf8').digest('hex');
}

/**
 * Resolves the commit base URL for a refactoring. Prefers the commit URL
 * RefactoringMiner already emits; otherwise builds one from the action context.
 * @returns {string} e.g. https://github.com/o/r/commit/<sha>, or '' if unknown
 */
function commitBase(ctx, r) {
  if (r._url && /\/commit\/[0-9a-f]+/i.test(r._url)) {
    return r._url.split('#')[0];
  }
  if (ctx && ctx.owner && ctx.repo && r._sha) {
    const server = ctx.serverUrl || 'https://github.com';
    return `${server}/${ctx.owner}/${ctx.repo}/commit/${r._sha}`;
  }
  return '';
}

/**
 * Builds a markdown link to the exact changed line on GitHub for one
 * refactoring. Targets the after-state (rightSide, `R<line>`) when present,
 * else the before-state (leftSide, `L<line>`). Returns '' when location or
 * commit context is missing, so the bullet degrades to plain text.
 * @returns {string} e.g. " ([↗ view diff](<url>#diff-<hash>R12))"
 */
function diffLink(ctx, r) {
  const right = r.rightSideLocations && r.rightSideLocations[0];
  const left = r.leftSideLocations && r.leftSideLocations[0];
  const loc = right || left;
  if (!loc || !loc.filePath || !loc.startLine) {
    return '';
  }
  const base = commitBase(ctx, r);
  if (!base) {
    return '';
  }
  const side = right ? 'R' : 'L';
  return ` ([↗ view diff](${base}#${fileAnchor(loc.filePath)}${side}${loc.startLine}))`;
}

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
 * @param {{ commits: Array<{ sha1?: string, url?: string, refactorings: Array<{ type: string, description: string, leftSideLocations?: Array<object>, rightSideLocations?: Array<object> }> }> }} data
 * @param {{ url: string, kind: 'pages' | 'artifact' }} [view] Optional interactive-view link.
 * @param {{ serverUrl?: string, owner?: string, repo?: string }} [ctx] Repo context for building per-line diff links.
 * @returns {string}
 */
function buildComment(data, view, ctx) {
  const all = data.commits.flatMap(c =>
    (c.refactorings || []).map(r => ({ ...r, _sha: c.sha1, _url: c.url }))
  );
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
    .map(r => `- **${r.type}** — ${r.description}${diffLink(ctx, r)}`)
    .join('\n');

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}${footer}`;
}

module.exports = { buildComment, COMMENT_HEADER };
