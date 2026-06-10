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
