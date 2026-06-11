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

describe('buildComment class-name links', () => {
  const crypto = require('crypto');
  const sha = 'a'.repeat(40);
  const prCtx = { serverUrl: 'https://github.com', owner: 'o', repo: 'r', prNumber: 9 };
  const pushCtx = { serverUrl: 'https://github.com', owner: 'o', repo: 'r' };
  const anchor = p => 'diff-' + crypto.createHash('sha256').update(p, 'utf8').digest('hex');
  const filesBase = 'https://github.com/o/r/pull/9/files';

  function renameAttribute() {
    return {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Rename Attribute',
          description: 'Rename Attribute fullName : String to displayName : String in class CustomerProfile',
          rightSideLocations: [{ filePath: 'src/main/java/CustomerProfile.java', startLine: 12 }],
          leftSideLocations: [{ filePath: 'src/main/java/CustomerProfile.java', startLine: 9 }],
        }],
      }],
    };
  }

  // Two classes: source linked at its old line (L), target at its new line (R).
  function moveAttribute() {
    return {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Move Attribute',
          description: 'Move Attribute private street : String from class CustomerProfile to class Address',
          leftSideLocations: [{ filePath: 'CustomerProfile.java', startLine: 30 }],
          rightSideLocations: [{ filePath: 'Address.java', startLine: 8 }],
        }],
      }],
    };
  }

  test('links the class name to the Files-changed diff at the right-side line', () => {
    const body = buildComment(renameAttribute(), undefined, prCtx);
    const href = `${filesBase}#${anchor('src/main/java/CustomerProfile.java')}R12`;
    expect(body).toContain(`in class [CustomerProfile](${href})`);
    expect(body).not.toContain('view diff');
  });

  test('hashes root-level paths too (not the literal filename)', () => {
    const body = buildComment(moveAttribute(), undefined, prCtx);
    expect(body).toContain(`#${anchor('Address.java')}R8`);
    expect(body).not.toContain('#diff-Address.java');
  });

  test('gives each class in a two-class refactoring its own file, line and side', () => {
    const body = buildComment(moveAttribute(), undefined, prCtx);
    expect(body).toContain(`class [CustomerProfile](${filesBase}#${anchor('CustomerProfile.java')}L30)`);
    expect(body).toContain(`class [Address](${filesBase}#${anchor('Address.java')}R8)`);
  });

  test('does not link an identifier that is a substring of another class name', () => {
    // 'class Account' must not match inside 'class AdminAccount'.
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Pull Up Method',
          description: 'Pull Up Method displayName from class AdminAccount to class Account',
          leftSideLocations: [{ filePath: 'AdminAccount.java', startLine: 5 }],
          rightSideLocations: [{ filePath: 'Account.java', startLine: 11 }],
        }],
      }],
    };
    const body = buildComment(data, undefined, prCtx);
    expect(body).toContain(`class [AdminAccount](${filesBase}#${anchor('AdminAccount.java')}L5)`);
    expect(body).toContain(`class [Account](${filesBase}#${anchor('Account.java')}R11)`);
    // No broken nested link formed inside 'AdminAccount'.
    expect(body).not.toContain('Admin[Account');
  });

  test('on a push (no PR) links the class name to the commit page', () => {
    const body = buildComment(renameAttribute(), undefined, pushCtx);
    const href = `https://github.com/o/r/commit/${sha}#${anchor('src/main/java/CustomerProfile.java')}R12`;
    expect(body).toContain(`in class [CustomerProfile](${href})`);
  });

  test('leaves the description plain when context is missing', () => {
    const body = buildComment(renameAttribute());
    expect(body).not.toContain('](http');
    expect(body).toContain('in class CustomerProfile');
  });

  test('leaves the description plain when locations are missing', () => {
    const body = buildComment(twoExtractOneRename(), undefined, prCtx);
    expect(body).not.toContain('](http');
    expect(body).toContain('- **Extract Method** — extract foo');
  });
});

describe('buildComment htmlDescription rendering', () => {
  const crypto = require('crypto');
  const sha = 'a'.repeat(40);
  const prCtx = { serverUrl: 'https://github.com', owner: 'o', repo: 'r', prNumber: 9 };
  const anchor = p => 'diff-' + crypto.createHash('sha256').update(p, 'utf8').digest('hex');
  const filesBase = 'https://github.com/o/r/pull/9/files';

  // Mirrors RefactoringMiner's JSON: toHTMLString() with the leading tab replaced by a space.
  function renameMethod() {
    return {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Rename Method',
          description: 'plain',
          htmlDescription: '<b>Rename Method</b> <code>private formatPaymentStatus(total int, discount int) : String</code>'
            + ' renamed to <code>private describePaymentStatus(total int, discount int) : String</code>'
            + ' in class <a href="">OrderProcessor</a>',
          rightSideLocations: [{ filePath: 'OrderProcessor.java', startLine: 7 }],
          leftSideLocations: [{ filePath: 'OrderProcessor.java', startLine: 7 }],
        }],
      }],
    };
  }

  test('wraps code spans in inline code and drops the leading bold name', () => {
    const body = buildComment(renameMethod(), undefined, prCtx);
    expect(body).toContain('`private formatPaymentStatus(total int, discount int) : String`');
    expect(body).toContain('`private describePaymentStatus(total int, discount int) : String`');
    expect(body).toContain('- **Rename Method** — `private formatPaymentStatus');
    // The html's own <b>name</b> must be stripped (no leftover tag, no duplicate name).
    expect(body).not.toContain('Rename Method</b>');
    expect(body).not.toContain('<code>');
  });

  test('turns the class <a> into a Files-changed diff line link', () => {
    const body = buildComment(renameMethod(), undefined, prCtx);
    expect(body).toContain(`in class [OrderProcessor](${filesBase}#${anchor('OrderProcessor.java')}R7)`);
  });

  test('renders an unmapped class name as plain text (no dead link)', () => {
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Move Class',
          description: 'plain',
          htmlDescription: '<b>Move Class</b> <code>A</code> moved to <code>B</code> from class <a href="">Mystery</a>',
        }],
      }],
    };
    const body = buildComment(data, undefined, prCtx);
    expect(body).toContain('from class Mystery');
    expect(body).not.toContain('[Mystery]');
  });

  test('widens the fence when code contains a backtick', () => {
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Rename Variable',
          description: 'plain',
          htmlDescription: '<b>Rename Variable</b> <code>a`b</code>',
        }],
      }],
    };
    const body = buildComment(data, undefined, prCtx);
    expect(body).toContain('`` a`b ``');
  });

  test('falls back to plain text plus class link when htmlDescription is absent', () => {
    const data = {
      commits: [{
        sha1: sha,
        refactorings: [{
          type: 'Rename Attribute',
          description: 'Rename Attribute fullName : String to displayName : String in class CustomerProfile',
          rightSideLocations: [{ filePath: 'CustomerProfile.java', startLine: 12 }],
        }],
      }],
    };
    const body = buildComment(data, undefined, prCtx);
    expect(body).toContain(`in class [CustomerProfile](${filesBase}#${anchor('CustomerProfile.java')}R12)`);
    expect(body).not.toContain('`');
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
