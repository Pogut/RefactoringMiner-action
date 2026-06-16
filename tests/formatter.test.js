const { buildComment, COMMENT_HEADER } = require('../src/formatter');

describe('buildComment', () => {
  test('returns a no-refactorings message for an empty array', () => {
    const body = buildComment([]);
    expect(body).toContain(COMMENT_HEADER);
    expect(body).toContain('No refactorings detected');
  });

  test('returns a no-refactorings message for non-array input', () => {
    const body = buildComment(undefined);
    expect(body).toContain('No refactorings detected');
  });

  test('reports the total count', () => {
    const body = buildComment(threeRefactorings());
    expect(body).toContain('Found 3 refactorings');
  });

  test('groups by type in the breakdown line', () => {
    const body = buildComment(threeRefactorings());
    expect(body).toContain('2 Rename Method');
    expect(body).toContain('1 Change Attribute Access Modifier');
  });

  test('renders each refactoring from its linked markup verbatim', () => {
    const body = buildComment(threeRefactorings());
    // The markup keeps RefactoringMiner's bold name, its [codeElement](url) diff
    // links, and its `inline code` class names exactly as produced.
    expect(body).toContain(
      '- **Change Attribute Access Modifier** [public](https://github.com/o/r/pull/9/changes?diff=split#diff-hashL3)',
    );
    expect(body).toContain('to [private](https://github.com/o/r/pull/9/changes?diff=split#diff-hashR3)');
    expect(body).toContain('in attribute [private loyaltyPoints : int](https://github.com/o/r/pull/9/changes?diff=split#diff-hashR3)');
    expect(body).toContain('from class `CustomerProfile`');
  });

  test('escapes underscores in linked dunder names so GitHub keeps them literal', () => {
    const base = 'https://github.com/o/r/pull/9/changes?diff=split#diff-hash';
    const body = buildComment([
      {
        type: 'Rename Method',
        markup: `**Rename Method** [private __init__(self) : None](${base}L5) renamed to [private __setup__(self) : None](${base}R6) in class \`CustomerProfile\``,
      },
    ]);
    // The link text is escaped (no bold "init"), but the URL and code span keep
    // their underscores untouched.
    expect(body).toContain(`[private \\_\\_init\\_\\_(self) : None](${base}L5)`);
    expect(body).toContain(`[private \\_\\_setup\\_\\_(self) : None](${base}R6)`);
    expect(body).not.toContain('[private __init__');
  });

  test('escapes asterisks in *args/**kwargs parameters', () => {
    const base = 'https://github.com/o/r/pull/9/changes?diff=split#diff-hash';
    const body = buildComment([
      { type: 'Add Parameter', markup: `**Add Parameter** [**kwargs](${base}R4) in method \`build\`` },
    ]);
    expect(body).toContain(`[\\*\\*kwargs](${base}R4)`);
  });

  test('leaves underscores in the link URL untouched', () => {
    // A repo named with an underscore must keep it, or the link breaks.
    const base = 'https://github.com/o/my_repo/pull/9/changes?diff=split#diff-hash';
    const body = buildComment([
      { type: 'Rename Method', markup: `**Rename Method** [foo()](${base}L5) in class \`A\`` },
    ]);
    expect(body).toContain(`[foo()](${base}L5)`);
    expect(body).toContain('my_repo');
  });

  test('escapes emphasis chars in the plain description fallback', () => {
    const body = buildComment([
      { type: 'Rename Method', description: 'Rename Method __init__ to __new__ in class C' },
    ]);
    expect(body).toContain('- Rename Method \\_\\_init\\_\\_ to \\_\\_new\\_\\_ in class C');
  });

  test('falls back to the plain description when markup is absent', () => {
    const body = buildComment([
      { type: 'Rename Variable', description: 'Rename Variable x to y in method m' },
    ]);
    expect(body).toContain('- Rename Variable x to y in method m');
  });

  test('falls back to the type when neither markup nor description is present', () => {
    const body = buildComment([{ type: 'Extract Method' }]);
    expect(body).toContain('- Extract Method');
  });

  test('appends a Pages view link when view kind is pages', () => {
    const body = buildComment(threeRefactorings(), { url: 'https://x.github.io/r/list/', kind: 'pages' });
    expect(body).toContain('View the interactive diff');
    expect(body).toContain('https://x.github.io/r/list/');
  });

  test('appends an artifact view link when view kind is artifact', () => {
    const body = buildComment(threeRefactorings(), { url: 'https://github.com/o/r/actions/runs/1', kind: 'artifact' });
    expect(body).toContain('workflow artifact');
    expect(body).toContain('https://github.com/o/r/actions/runs/1');
  });

  test('appends the view link even when no refactorings are detected', () => {
    const body = buildComment([], { url: 'https://x.github.io/r/list/', kind: 'pages' });
    expect(body).toContain('No refactorings detected');
    expect(body).toContain('View the interactive diff');
  });

  test('omits the footer when no view is provided', () => {
    const body = buildComment(threeRefactorings());
    expect(body).not.toContain('View the interactive diff');
    expect(body).not.toContain('workflow artifact');
  });
});

// ---------------------------------------------------------------------------
// Fixtures — shaped like the `refactorings` array in jsons/refactorings.json,
// with the GitHub-linked markup RefactoringMiner emits.
// ---------------------------------------------------------------------------

function threeRefactorings() {
  const base = 'https://github.com/o/r/pull/9/changes?diff=split#diff-hash';
  return [
    {
      type: 'Rename Method',
      description: 'Rename Method private foo() : void renamed to private bar() : void in class A',
      markup: `**Rename Method** [private foo() : void](${base}L5) renamed to [private bar() : void](${base}R6) in class \`A\``,
    },
    {
      type: 'Rename Method',
      description: 'Rename Method private one() : int renamed to private two() : int in class B',
      markup: `**Rename Method** [private one() : int](${base}L8) renamed to [private two() : int](${base}R9) in class \`B\``,
    },
    {
      type: 'Change Attribute Access Modifier',
      description: 'Change Attribute Access Modifier public to private in attribute private loyaltyPoints : int from class CustomerProfile',
      markup: `**Change Attribute Access Modifier** [public](${base}L3) to [private](${base}R3) in attribute [private loyaltyPoints : int](${base}R3) from class \`CustomerProfile\``,
    },
  ];
}
