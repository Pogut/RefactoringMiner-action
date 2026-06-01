jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
}));

const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const { buildRmArgs, runRefactoringMiner } = require('../src/runner');

const FAKE_TMP = '/tmp/rm-fakeXYZ';
const FAKE_DATA = { commits: [{ refactorings: [] }] };
const FAKE_EVENT = {
  pull_request: { base: { sha: 'base111' }, head: { sha: 'head222' } },
};

// ---------------------------------------------------------------------------
// buildRmArgs
// ---------------------------------------------------------------------------
describe('buildRmArgs', () => {
  const originalEnv = process.env;

  beforeEach(() => { process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  test('uses -c flag for push events', () => {
    process.env.GITHUB_SHA = 'abc123';
    const args = buildRmArgs('push', null);
    expect(args).toContain('-c');
    expect(args).toContain('abc123');
    expect(args).not.toContain('-bc');
  });

  test('includes -json flag for push events', () => {
    process.env.GITHUB_SHA = 'sha999';
    expect(buildRmArgs('push', null)).toContain('-json');
  });

  test('uses -bc flag for pull_request events', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify(FAKE_EVENT));
    const args = buildRmArgs('pull_request', '/fake/event.json');
    expect(args).toContain('-bc');
    expect(args).toContain('base111');
    expect(args).toContain('head222');
    expect(args).not.toContain('-c');
  });

  test('reads SHAs from the event file for pull_request events', () => {
    const event = { pull_request: { base: { sha: 'aaa' }, head: { sha: 'bbb' } } };
    fs.readFileSync.mockReturnValue(JSON.stringify(event));
    const args = buildRmArgs('pull_request', '/event.json');
    expect(args).toContain('aaa');
    expect(args).toContain('bbb');
  });
});

// ---------------------------------------------------------------------------
// runRefactoringMiner
// ---------------------------------------------------------------------------
describe('runRefactoringMiner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_SHA = 'testsha';
    fs.mkdtempSync.mockReturnValue(FAKE_TMP);
    fs.readFileSync.mockReturnValue(JSON.stringify(FAKE_DATA));
    fs.rmSync.mockReturnValue(undefined);
    exec.exec.mockResolvedValue(0);
    core.info.mockReturnValue(undefined);
  });

  test('creates a private temp directory prefixed with rm-', async () => {
    await runRefactoringMiner('/workspace', 'push', null);
    expect(fs.mkdtempSync).toHaveBeenCalledTimes(1);
    expect(fs.mkdtempSync.mock.calls[0][0]).toMatch(/rm-$/);
  });

  test('pulls the Docker image before running', async () => {
    await runRefactoringMiner('/workspace', 'push', null);
    const [cmd, args] = exec.exec.mock.calls[0];
    expect(cmd).toBe('docker');
    expect(args).toEqual(['pull', 'tsantalis/refactoringminer:latest']);
  });

  test('mounts workspace and temp dir into the container', async () => {
    await runRefactoringMiner('/workspace', 'push', null);
    const [, args] = exec.exec.mock.calls[1];
    expect(args).toContain('/workspace:/workspace');
    expect(args).toContain(`${FAKE_TMP}:/output`);
  });

  test('returns the parsed JSON from the output file', async () => {
    const result = await runRefactoringMiner('/workspace', 'push', null);
    expect(result).toEqual(FAKE_DATA);
  });

  test('cleans up the temp directory after a successful run', async () => {
    await runRefactoringMiner('/workspace', 'push', null);
    expect(fs.rmSync).toHaveBeenCalledWith(FAKE_TMP, { recursive: true, force: true });
  });

  test('cleans up the temp directory even when Docker run fails', async () => {
    exec.exec
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('Docker run failed'));

    await expect(runRefactoringMiner('/workspace', 'push', null))
      .rejects.toThrow('Docker run failed');

    expect(fs.rmSync).toHaveBeenCalledWith(FAKE_TMP, { recursive: true, force: true });
  });
});
