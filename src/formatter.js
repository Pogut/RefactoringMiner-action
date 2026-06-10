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
 * The base GitHub URL to anchor diffs against. On a pull request, that is the
 * "Files changed" tab (`.../pull/<n>/files`) — its anchors resolve to the exact
 * line even across many commits, unlike an individual commit page. On a push,
 * falls back to the commit page. Returns '' when context is missing.
 * @returns {string}
 */
function linkBase(ctx, r) {
  if (ctx && ctx.prNumber && ctx.owner && ctx.repo) {
    const server = ctx.serverUrl || 'https://github.com';
    return `${server}/${ctx.owner}/${ctx.repo}/pull/${ctx.prNumber}/files`;
  }
  return commitBase(ctx, r);
}

/** Simple class name from a repo-relative path: "src/main/A.java" -> "A". */
function classSimpleName(filePath) {
  if (!filePath) {
    return '';
  }
  const base = filePath.substring(filePath.lastIndexOf('/') + 1);
  return base.endsWith('.java') ? base.slice(0, -5) : base;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Maps each involved class name to its own GitHub line anchor. The after-state
 * file is linked at its new line (`R`); a file seen only on the before-state is
 * linked at its old line (`L`). Right side is recorded first, so a file changed
 * in place wins its after-state line.
 * @returns {Map<string, string>} className -> full href
 */
function classLinks(base, r) {
  const map = new Map();
  for (const loc of r.rightSideLocations || []) {
    const name = classSimpleName(loc.filePath);
    if (name && loc.startLine && !map.has(name)) {
      map.set(name, `${base}#${fileAnchor(loc.filePath)}R${loc.startLine}`);
    }
  }
  for (const loc of r.leftSideLocations || []) {
    const name = classSimpleName(loc.filePath);
    if (name && loc.startLine && !map.has(name)) {
      map.set(name, `${base}#${fileAnchor(loc.filePath)}L${loc.startLine}`);
    }
  }
  return map;
}

/**
 * Renders a refactoring's description with each class name turned into a link
 * to its exact changed line, matching the web view. Only names written as
 * "class <Name>" are linked (so identifiers inside code snippets are left
 * alone). Degrades to the plain description when context or locations are
 * missing.
 * @returns {string}
 */
function linkifyDescription(ctx, r) {
  const description = r.description || '';
  const base = linkBase(ctx, r);
  if (!base) {
    return description;
  }
  let out = description;
  for (const [name, href] of classLinks(base, r)) {
    const re = new RegExp('(?<=class )' + escapeRegExp(name) + '\\b', 'g');
    out = out.replace(re, `[${name}](${href})`);
  }
  return out;
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
 * @param {{ serverUrl?: string, owner?: string, repo?: string, prNumber?: number }} [ctx] Repo/PR context for building per-line diff links.
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
    .map(r => `- **${r.type}** — ${linkifyDescription(ctx, r)}`)
    .join('\n');

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}${footer}`;
}

module.exports = { buildComment, COMMENT_HEADER };
