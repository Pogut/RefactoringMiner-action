const COMMENT_HEADER = '### RefactoringMiner Report';

/**
 * Links to a file line on GitHub as a blob permalink
 * (`.../blob/<sha>/<path>#L<line>`). Unlike a Files-changed diff anchor, a blob
 * line anchor scrolls to and highlights the line reliably even on GitHub's
 * in-app (Turbo) navigation, so it works in the same tab. The after-state line
 * (`R`) is pinned at the head commit; a before-state line (`L`) at the base
 * commit (falling back to head when no base is known, e.g. push events).
 * @returns {string|null} full href, or null when context is insufficient
 */
function blobLink(ctx, filePath, line, side) {
  if (!ctx || !ctx.owner || !ctx.repo || !filePath || !line) {
    return null;
  }
  const sha = (side === 'L' ? ctx.baseSha : ctx.headSha) || ctx.headSha;
  if (!sha) {
    return null;
  }
  const server = ctx.serverUrl || 'https://github.com';
  return `${server}/${ctx.owner}/${ctx.repo}/blob/${sha}/${filePath}#L${line}`;
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
 * Maps each involved class name to a blob link at its own line. The after-state
 * file is linked at its new line (head commit, `R`); a file seen only on the
 * before-state at its old line (base commit, `L`). Right side is recorded
 * first, so a file changed in place wins its after-state line.
 * @returns {Map<string, string>} className -> full href
 */
function classLinks(ctx, r) {
  const map = new Map();
  const add = (locations, side) => {
    for (const loc of locations || []) {
      const name = classSimpleName(loc.filePath);
      if (name && loc.startLine && !map.has(name)) {
        const href = blobLink(ctx, loc.filePath, loc.startLine, side);
        if (href) {
          map.set(name, href);
        }
      }
    }
  };
  add(r.rightSideLocations, 'R');
  add(r.leftSideLocations, 'L');
  return map;
}

/**
 * Renders a refactoring's description with each class name turned into a blob
 * link to its line. Only names written as "class <Name>" are linked (so
 * identifiers inside code snippets are left alone). Degrades to the plain
 * description when context or locations are missing.
 * @returns {string}
 */
function linkifyDescription(ctx, r) {
  const description = r.description || '';
  const links = classLinks(ctx, r);
  if (links.size === 0) {
    return description;
  }
  let out = description;
  for (const [name, href] of links) {
    const re = new RegExp('(?<=class )' + escapeRegExp(name) + '\\b', 'g');
    out = out.replace(re, `[${name}](${href})`);
  }
  return out;
}

/**
 * Wraps code in markdown inline code. When the content itself contains
 * backticks, widens the fence and pads with spaces per CommonMark, so
 * signatures never break the span.
 * @returns {string}
 */
function inlineCode(s) {
  const longestRun = (s.match(/`+/g) || []).reduce((m, run) => Math.max(m, run.length), 0);
  const fence = '`'.repeat(longestRun + 1);
  const pad = longestRun > 0 ? ' ' : '';
  return `${fence}${pad}${s}${pad}${fence}`;
}

/**
 * Renders a refactoring description using the markup RefactoringMiner already
 * produced (`r.htmlDescription`): `<code>` spans become inline code and class
 * `<a>` tags become links to their changed line. The leading `<b>name</b>` is
 * dropped because the type is already shown as the bold bullet prefix. Falls
 * back to {@link linkifyDescription} when the field is absent (e.g. an older
 * image), so the comment degrades cleanly.
 * @returns {string}
 */
function renderDescription(ctx, r) {
  const html = r.htmlDescription;
  if (!html) {
    return linkifyDescription(ctx, r);
  }
  const links = classLinks(ctx, r);
  // Only the three known tags are translated; everything else (including raw
  // '<'/'>' from generics inside <code>) passes through literally.
  const body = html.replace(/^<b>[\s\S]*?<\/b>\s*/, '');
  return body.replace(
    /<code>([\s\S]*?)<\/code>|<a href="">([\s\S]*?)<\/a>|<b>([\s\S]*?)<\/b>/g,
    (match, code, link, bold) => {
      if (code !== undefined) {
        return inlineCode(code);
      }
      if (link !== undefined) {
        const simple = link.substring(link.lastIndexOf('.') + 1);
        const href = links.get(simple);
        return href ? `[${link}](${href})` : link;
      }
      return `**${bold}**`;
    }
  );
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
 * @param {{ commits: Array<{ sha1?: string, url?: string, refactorings: Array<{ type: string, description: string, htmlDescription?: string, leftSideLocations?: Array<object>, rightSideLocations?: Array<object> }> }> }} data
 * @param {{ url: string, kind: 'pages' | 'artifact' }} [view] Optional interactive-view link.
 * @param {{ serverUrl?: string, owner?: string, repo?: string, headSha?: string, baseSha?: string }} [ctx] Repo/commit context for building per-line blob links.
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
    .map(r => `- **${r.type}** — ${renderDescription(ctx, r)}`)
    .join('\n');

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}${footer}`;
}

module.exports = { buildComment, COMMENT_HEADER };
