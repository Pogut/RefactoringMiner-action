jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const { buildAnalysisUrl, exportWebDiff } = require('../src/exporter');

const FAKE_TMP = '/tmp/rm-web-fakeXYZ';

// ---------------------------------------------------------------------------
// buildAnalysisUrl
// ---------------------------------------------------------------------------
describe('buildAnalysisUrl', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; jest.clearAllMocks(); });
  afterEach(() => { process.env = originalEnv; });

  test('uses the PR html_url for pull_request events', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      pull_request: { html_url: 'https://github.com/o/r/pull/7' },
    }));
    expect(buildAnalysisUrl('pull_request', '/event.json')).toBe('https://github.com/o/r/pull/7');
  });

  test('constructs a commit URL for push events', () => {
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_REPOSITORY = 'o/r';
    process.env.GITHUB_SHA = 'deadbeef';
    expect(buildAnalysisUrl('push', null)).toBe('https://github.com/o/r/commit/deadbeef');
  });
});

// ---------------------------------------------------------------------------
// exportWebDiff
// ---------------------------------------------------------------------------
describe('exportWebDiff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdtempSync.mockReturnValue(FAKE_TMP);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      pull_request: { html_url: 'https://github.com/o/r/pull/7' },
    }));
    fs.existsSync.mockReturnValue(true);
    exec.exec.mockResolvedValue(0);
    core.info.mockReturnValue(undefined);
  });

  test('runs the diff --url export with the analysis URL and token', async () => {
    await exportWebDiff('pull_request', '/event.json', 'tsantalis/refactoringminer:latest', 'tok123');
    const [cmd, args] = exec.exec.mock.calls[0];
    const script = args[args.length - 1];
    expect(cmd).toBe('docker');
    expect(args).toContain('OAuthToken=tok123');
    expect(args).toContain('tsantalis/refactoringminer:latest');
    expect(script).toContain('refactoringminer diff --url "https://github.com/o/r/pull/7" -e');
    expect(script).toContain('web/resources');
  });

  test('mounts the temp dir at the container export path', async () => {
    await exportWebDiff('pull_request', '/event.json', 'img', 'tok');
    const [, args] = exec.exec.mock.calls[0];
    expect(args).toContain(`${FAKE_TMP}:/diff/exported`);
  });

  test('returns the path to the exported web directory', async () => {
    const webDir = await exportWebDiff('pull_request', '/event.json', 'img', 'tok');
    expect(webDir).toBe(`${FAKE_TMP}/web`);
  });

  test('throws when the export did not produce a web view', async () => {
    fs.existsSync.mockReturnValue(false);
    await expect(exportWebDiff('pull_request', '/event.json', 'img', 'tok'))
      .rejects.toThrow('was not produced');
  });
});
