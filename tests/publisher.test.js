jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/artifact', () => ({
  DefaultArtifactClient: jest.fn().mockImplementation(() => ({
    uploadArtifact: jest.fn().mockResolvedValue({ id: 1 }),
  })),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn(() => '/tmp/rm-pages-x'),
  mkdirSync: jest.fn(),
  cpSync: jest.fn(),
  rmSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  readdirSync: jest.fn(() => [{ name: 'index.html', isDirectory: () => false }]),
}));

const exec = require('@actions/exec');
const fs = require('fs');
const {
  decideTarget,
  publishToPages,
  uploadArtifactView,
  cleanupPages,
  pagesUrl,
} = require('../src/publisher');

function octokitWithPages(impl) {
  return { rest: { repos: { getPages: impl, createPagesSite: jest.fn().mockResolvedValue({}) } } };
}

// ---------------------------------------------------------------------------
// decideTarget
// ---------------------------------------------------------------------------
describe('decideTarget', () => {
  test('private repos always use the artifact path', async () => {
    const octokit = octokitWithPages(jest.fn());
    expect(await decideTarget(octokit, 'o', 'r', true)).toBe('artifact');
    expect(octokit.rest.repos.getPages).not.toHaveBeenCalled();
  });

  test('unconfigured Pages (404) selects the pages path', async () => {
    const octokit = octokitWithPages(jest.fn().mockRejectedValue({ status: 404 }));
    expect(await decideTarget(octokit, 'o', 'r', false)).toBe('pages');
  });

  test('Pages already served from gh-pages selects the pages path', async () => {
    const octokit = octokitWithPages(jest.fn().mockResolvedValue({
      data: { build_type: 'legacy', source: { branch: 'gh-pages', path: '/' } },
    }));
    expect(await decideTarget(octokit, 'o', 'r', false)).toBe('pages');
  });

  test('Pages served from another branch falls back to artifact', async () => {
    const octokit = octokitWithPages(jest.fn().mockResolvedValue({
      data: { build_type: 'legacy', source: { branch: 'main', path: '/docs' } },
    }));
    expect(await decideTarget(octokit, 'o', 'r', false)).toBe('artifact');
  });

  test('Pages built via Actions workflow falls back to artifact', async () => {
    const octokit = octokitWithPages(jest.fn().mockResolvedValue({
      data: { build_type: 'workflow', source: { branch: 'gh-pages', path: '/' } },
    }));
    expect(await decideTarget(octokit, 'o', 'r', false)).toBe('artifact');
  });

  test('unexpected API errors fall back to artifact', async () => {
    const octokit = octokitWithPages(jest.fn().mockRejectedValue({ status: 500, message: 'boom' }));
    expect(await decideTarget(octokit, 'o', 'r', false)).toBe('artifact');
  });
});

// ---------------------------------------------------------------------------
// pagesUrl
// ---------------------------------------------------------------------------
describe('pagesUrl', () => {
  test('builds a lowercase-owner project Pages URL under the PR subpath', () => {
    expect(pagesUrl('MyOrg', 'MyRepo', 12, 'abc123'))
      .toBe('https://myorg.github.io/MyRepo/refactorings/pr-12/abc123/list/');
  });
});

// ---------------------------------------------------------------------------
// publishToPages
// ---------------------------------------------------------------------------
describe('publishToPages', () => {
  beforeEach(() => { jest.clearAllMocks(); exec.exec.mockResolvedValue(0); });

  test('pushes to gh-pages, enables Pages, and returns the view URL', async () => {
    const octokit = octokitWithPages(jest.fn());
    const url = await publishToPages({
      octokit, token: 't', serverUrl: 'https://github.com',
      owner: 'o', repo: 'r', webDir: '/tmp/web', prNumber: 5, sha: 'sha9',
    });

    expect(url).toBe('https://o.github.io/r/refactorings/pr-5/sha9/list/');
    const pushed = exec.exec.mock.calls.some(
      ([cmd, args]) => cmd === 'git' && args[0] === 'push',
    );
    expect(pushed).toBe(true);
    expect(octokit.rest.repos.createPagesSite).toHaveBeenCalled();
  });

  test('writes a .nojekyll marker so Pages serves assets verbatim', async () => {
    const octokit = octokitWithPages(jest.fn());
    await publishToPages({
      octokit, token: 't', serverUrl: 'https://github.com',
      owner: 'o', repo: 'r', webDir: '/tmp/web', prNumber: 5, sha: 'sha9',
    });
    const wroteNoJekyll = fs.writeFileSync.mock.calls.some(
      ([file]) => String(file).endsWith('.nojekyll'),
    );
    expect(wroteNoJekyll).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// uploadArtifactView
// ---------------------------------------------------------------------------
describe('uploadArtifactView', () => {
  test('returns the workflow run URL', async () => {
    const url = await uploadArtifactView({
      webDir: '/tmp/web', serverUrl: 'https://github.com',
      owner: 'o', repo: 'r', runId: '999',
    });
    expect(url).toBe('https://github.com/o/r/actions/runs/999');
  });
});

// ---------------------------------------------------------------------------
// cleanupPages
// ---------------------------------------------------------------------------
describe('cleanupPages', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('does nothing when the gh-pages branch does not exist', async () => {
    exec.exec.mockResolvedValue(1); // clone fails
    await cleanupPages({ token: 't', serverUrl: 'https://github.com', owner: 'o', repo: 'r', prNumber: 5 });
    const pushed = exec.exec.mock.calls.some(([cmd, args]) => cmd === 'git' && args[0] === 'push');
    expect(pushed).toBe(false);
  });
});
