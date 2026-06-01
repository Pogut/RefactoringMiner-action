// TODO: add tests for buildRmArgs and runRefactoringMiner
// - buildRmArgs for pull_request events (mock fs.readFileSync + GITHUB_EVENT_PATH)
// - buildRmArgs for push events (mock GITHUB_SHA)
// - runRefactoringMiner: mock @actions/exec and fs to verify Docker args
const { buildRmArgs } = require('../src/runner');

describe('buildRmArgs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('uses -c flag for push events', () => {
    process.env.GITHUB_SHA = 'abc123';
    const args = buildRmArgs('push', null);
    expect(args).toContain('-c');
    expect(args).toContain('abc123');
    expect(args).not.toContain('-bc');
  });
});
