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
 * Backslash-escapes the Markdown emphasis characters in a run of rendered text.
 *
 * GitHub treats `_` and `*` as emphasis delimiters, so Python identifiers carry
 * them straight into the rendered output: `__init__` becomes a bold "init",
 * `*args`/`**kwargs` turn italic/bold. Escaping them keeps the literal name.
 * Other punctuation in code elements (parens, colons, generics) is left alone.
 */
function escapeEmphasis(text) {
  return text.replace(/[_*]/g, '\\$&');
}

/**
 * Escapes emphasis only in the *rendered text* of RefactoringMiner's markup,
 * leaving the markup machinery untouched.
 *
 * toMarkupStringWithGitHubLinks emits three constructs: `**bold name**`,
 * `[link text](url)` and `` `inline code` ``. Emphasis is inert inside code
 * spans and inside the `(url)` (and the URL may legitimately contain `_`, eg a
 * repo named `my_repo`, so escaping it would break the link), so we leave those
 * verbatim and escape only the link text and the plain glue between constructs.
 * The literal `**` bold markers are preserved.
 */
function escapeMarkupEmphasis(markup) {
  // In priority order: a code span, a [text](url) link, or a ** bold marker.
  // Everything between matches is plain glue text.
  const TOKEN = /(`[^`]*`)|(\[.*?\]\(.*?\))|(\*\*)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = TOKEN.exec(markup)) !== null) {
    out += escapeEmphasis(markup.slice(last, m.index));
    if (m[1] !== undefined) {
      out += m[1]; // code span — verbatim
    } else if (m[2] !== undefined) {
      const link = m[2].match(/^\[(.*?)\]\((.*?)\)$/);
      out += `[${escapeEmphasis(link[1])}](${link[2]})`; // escape text, keep url
    } else {
      out += '**'; // bold marker — verbatim
    }
    last = TOKEN.lastIndex;
  }
  return out + escapeEmphasis(markup.slice(last));
}

/**
 * Renders a single refactoring as a bullet.
 *
 * RefactoringMiner already produces a `markup` field where code elements are
 * markdown links to the exact GitHub diff lines and class names are inline code
 * (toMarkupStringWithGitHubLinks). It starts with the bold refactoring name. We
 * pass it through escapeMarkupEmphasis so identifiers with `_`/`*` (eg Python's
 * `__init__`) survive GitHub's Markdown rendering. `description` is the
 * plain-text fallback for output that predates the markup field (eg a non-GitHub
 * remote, or an older image); it carries the same identifiers, so it is fully
 * escaped too.
 *
 * @param {{ type: string, description?: string, markup?: string }} r
 * @returns {string}
 */
function renderRefactoring(r) {
  if (r.markup) {
    return `- ${escapeMarkupEmphasis(r.markup)}`;
  }
  if (r.description) {
    return `- ${escapeEmphasis(r.description)}`;
  }
  return `- ${r.type}`;
}

/**
 * Builds a markdown comment body from the refactorings RefactoringMiner detected.
 * @param {Array<{ type: string, description?: string, markup?: string }>} refactorings
 *   The `refactorings` array from the exported `jsons/refactorings.json`.
 * @param {{ url: string, kind: 'pages' | 'artifact' }} [view] Optional interactive-view link.
 * @returns {string}
 */
function buildComment(refactorings, view) {
  const all = Array.isArray(refactorings) ? refactorings : [];
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

  const details = all.map(renderRefactoring).join('\n');

  return `${COMMENT_HEADER}\nFound ${all.length} refactorings: ${breakdown}\n\n${details}${footer}`;
}

module.exports = { buildComment, COMMENT_HEADER };
