const { buildComment, COMMENT_HEADER } = require('../src/formatter');

describe('buildComment', () => {
  test('returns a no-refactorings message when commits array is empty', () => {
    const body = buildComment({ commits: [] });
    expect(body).toContain(COMMENT_HEADER);
    expect(body).toContain('No refactorings detected');
  });

  test('returns a no-refactorings message when commits have empty refactorings', () => {
    const body = buildComment({ commits: [{ refactorings: [] }, { refactorings: [] }] });
    expect(body).toContain('No refactorings detected');
  });

  test('reports the total count', () => {
    const body = buildComment(twoExtractOneRename());
    expect(body).toContain('Found 3 refactorings');
  });

  test('groups by type in the breakdown line', () => {
    const body = buildComment(twoExtractOneRename());
    expect(body).toContain('2 Extract Method');
    expect(body).toContain('1 Rename Variable');
  });

  test('lists each refactoring as a bullet', () => {
    const body = buildComment(twoExtractOneRename());
    expect(body).toContain('- **Extract Method** — extract foo');
    expect(body).toContain('- **Extract Method** — extract bar');
    expect(body).toContain('- **Rename Variable** — rename baz');
  });

  test('flattens refactorings across multiple commits', () => {
    const data = {
      commits: [
        { refactorings: [{ type: 'Extract Method', description: 'a' }] },
        { refactorings: [{ type: 'Extract Method', description: 'b' }] },
      ],
    };
    const body = buildComment(data);
    expect(body).toContain('Found 2 refactorings');
  });

  test('appends a Pages view link when view kind is pages', () => {
    const body = buildComment(twoExtractOneRename(), { url: 'https://x.github.io/r/list/', kind: 'pages' });
    expect(body).toContain('View the interactive diff');
    expect(body).toContain('https://x.github.io/r/list/');
  });

  test('appends an artifact view link when view kind is artifact', () => {
    const body = buildComment(twoExtractOneRename(), { url: 'https://github.com/o/r/actions/runs/1', kind: 'artifact' });
    expect(body).toContain('workflow artifact');
    expect(body).toContain('https://github.com/o/r/actions/runs/1');
  });

  test('appends the view link even when no refactorings are detected', () => {
    const body = buildComment({ commits: [] }, { url: 'https://x.github.io/r/list/', kind: 'pages' });
    expect(body).toContain('No refactorings detected');
    expect(body).toContain('View the interactive diff');
  });

  test('omits the footer when no view is provided', () => {
    const body = buildComment(twoExtractOneRename());
    expect(body).not.toContain('View the interactive diff');
    expect(body).not.toContain('workflow artifact');
  });
});

describe('buildComment diff links', () => {
  const crypto = require('crypto');
  const ctx = { serverUrl: 'https://github.com', owner: 'o', repo: 'r' };
  const sha = 'a'.repeat(40);
  const anchor = p => 'diff-' + crypto.createHash('sha256').update(p, 'utf8').digest('hex');

  function withLocations() {
    return {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Rename Attribute',
          description: 'Rename Attribute fullName to displayName',
          rightSideLocations: [{ filePath: 'src/main/java/CustomerProfile.java', startLine: 12 }],
          leftSideLocations: [{ filePath: 'src/main/java/CustomerProfile.java', startLine: 9 }],
        }],
      }],
    };
  }

  test('appends a commit link targeting the right-side line', () => {
    const body = buildComment(withLocations(), undefined, ctx);
    const expected = `https://github.com/o/r/commit/${sha}#${anchor('src/main/java/CustomerProfile.java')}R12`;
    expect(body).toContain(`[↗ view diff](${expected})`);
  });

  test('hashes root-level paths too (not the literal filename)', () => {
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Encapsulate Attribute',
          description: 'Encapsulate Attribute loyaltyPoints',
          rightSideLocations: [{ filePath: 'CustomerProfile.java', startLine: 3 }],
        }],
      }],
    };
    const body = buildComment(data, undefined, ctx);
    expect(body).toContain(`#${anchor('CustomerProfile.java')}R3`);
    expect(body).not.toContain('#diff-CustomerProfile.java');
  });

  test('falls back to the left side when no right-side location exists', () => {
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Inline Method',
          description: 'Inline Method centsToDollars',
          leftSideLocations: [{ filePath: 'OrderProcessor.java', startLine: 7 }],
        }],
      }],
    };
    const body = buildComment(data, undefined, ctx);
    expect(body).toContain(`#${anchor('OrderProcessor.java')}L7`);
  });

  test('prefers the commit url emitted by RefactoringMiner', () => {
    const data = {
      commits: [{
        sha1: sha,
        url: 'https://ghe.example.com/o/r/commit/deadbeef',
        refactorings: [{
          type: 'Rename Attribute',
          description: 'x',
          rightSideLocations: [{ filePath: 'A.java', startLine: 1 }],
        }],
      }],
    };
    const body = buildComment(data, undefined, ctx);
    expect(body).toContain(`https://ghe.example.com/o/r/commit/deadbeef#${anchor('A.java')}R1`);
  });

  test('omits the link when context is missing', () => {
    const body = buildComment(withLocations());
    expect(body).not.toContain('view diff');
    expect(body).toContain('- **Rename Attribute** — Rename Attribute fullName to displayName');
  });

  test('omits the link when locations are missing', () => {
    const body = buildComment(twoExtractOneRename(), undefined, ctx);
    expect(body).not.toContain('view diff');
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function twoExtractOneRename() {
  return {
    commits: [{
      refactorings: [
        { type: 'Extract Method', description: 'extract foo' },
        { type: 'Extract Method', description: 'extract bar' },
        { type: 'Rename Variable', description: 'rename baz' },
      ],
    }],
  };
}
