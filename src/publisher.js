const core = require('@actions/core');
const exec = require('@actions/exec');
const { DefaultArtifactClient } = require('@actions/artifact');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PAGES_BRANCH = 'gh-pages';
const PAGES_ROOT = 'refactorings';
const ARTIFACT_NAME = 'refactoring-diff';
const GIT_USER = 'github-actions[bot]';
const GIT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

/**
 * Decides where to publish the exported web view.
 *
 *   private repo                          -> 'artifact'
 *   Pages unconfigured (404)              -> 'pages'  (we create + enable gh-pages)
 *   Pages already served from gh-pages    -> 'pages'  (ours / compatible, we use a subpath)
 *   Pages served from anything else       -> 'artifact'  (their own site; don't clobber it)
 */
async function decideTarget(octokit, owner, repo, isPrivate) {
  if (isPrivate) {
    return 'artifact';
  }

  try {
    const { data } = await octokit.rest.repos.getPages({ owner, repo });
    const fromGhPages = data.build_type !== 'workflow' && data.source && data.source.branch === PAGES_BRANCH;
    return fromGhPages ? 'pages' : 'artifact';
  } catch (err) {
    if (err.status === 404) {
      return 'pages';
    }
    core.warning(`Could not query GitHub Pages (${err.message}); falling back to artifact.`);
    return 'artifact';
  }
}

function authRemote(serverUrl, owner, repo, token) {
  const host = new URL(serverUrl).host;
  return `https://x-access-token:${token}@${host}/${owner}/${repo}.git`;
}

function pagesUrl(owner, repo, prNumber, sha) {
  return `https://${owner.toLowerCase()}.github.io/${repo}/${PAGES_ROOT}/pr-${prNumber}/${sha}/list/`;
}

async function git(args, cwd) {
  return exec.exec('git', args, { cwd, ignoreReturnCode: true });
}

/**
 * Clones (or creates) the gh-pages branch into a fresh temp checkout and
 * returns its path. Falls back to an orphan branch when gh-pages doesn't exist.
 */
async function checkoutPagesBranch(remote) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-pages-'));
  const cloned = await exec.exec(
    'git',
    ['clone', '--depth', '1', '--branch', PAGES_BRANCH, '--single-branch', remote, dir],
    { ignoreReturnCode: true },
  );

  if (cloned !== 0) {
    await git(['init'], dir);
    await git(['remote', 'add', 'origin', remote], dir);
    await git(['checkout', '--orphan', PAGES_BRANCH], dir);
  }

  await git(['config', 'user.name', GIT_USER], dir);
  await git(['config', 'user.email', GIT_EMAIL], dir);
  return dir;
}

async function commitAndPush(dir, message) {
  await git(['add', '-A'], dir);
  const committed = await git(['commit', '-m', message], dir);
  if (committed !== 0) {
    return; // nothing to commit
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await git(['push', 'origin', PAGES_BRANCH], dir)) === 0) {
      return;
    }
    // Likely a concurrent push from another PR/commit — rebase and retry.
    await git(['pull', '--rebase', 'origin', PAGES_BRANCH], dir);
  }
  throw new Error('Failed to push to gh-pages after retries');
}

/**
 * Publishes the exported web view to the gh-pages branch under
 * refactorings/pr-<n>/<sha>/ and enables Pages if needed. Returns the view URL.
 */
async function publishToPages({ octokit, token, serverUrl, owner, repo, webDir, prNumber, sha }) {
  const remote = authRemote(serverUrl, owner, repo, token);
  const dir = await checkoutPagesBranch(remote);

  const dest = path.join(dir, PAGES_ROOT, `pr-${prNumber}`, sha);
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(webDir, dest, { recursive: true });

  await commitAndPush(dir, `Publish refactoring diff for PR #${prNumber} (${sha})`);
  fs.rmSync(dir, { recursive: true, force: true });

  await ensurePagesEnabled(octokit, owner, repo);
  return pagesUrl(owner, repo, prNumber, sha);
}

async function ensurePagesEnabled(octokit, owner, repo) {
  try {
    await octokit.rest.repos.createPagesSite({
      owner,
      repo,
      source: { branch: PAGES_BRANCH, path: '/' },
    });
  } catch (err) {
    // 409 = already enabled, which is the common case after the first run.
    if (err.status !== 409) {
      core.warning(`Could not enable GitHub Pages automatically: ${err.message}`);
    }
  }
}

/** Removes a closed PR's published diffs from gh-pages. Best-effort. */
async function cleanupPages({ token, serverUrl, owner, repo, prNumber }) {
  const remote = authRemote(serverUrl, owner, repo, token);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-pages-'));
  const cloned = await exec.exec(
    'git',
    ['clone', '--depth', '1', '--branch', PAGES_BRANCH, '--single-branch', remote, dir],
    { ignoreReturnCode: true },
  );
  if (cloned !== 0) {
    return; // no gh-pages branch, nothing to clean
  }

  const target = path.join(dir, PAGES_ROOT, `pr-${prNumber}`);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    await git(['config', 'user.name', GIT_USER], dir);
    await git(['config', 'user.email', GIT_EMAIL], dir);
    await commitAndPush(dir, `Remove refactoring diff for closed PR #${prNumber}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** Uploads the web view as a workflow artifact; returns the run page URL. */
async function uploadArtifactView({ webDir, serverUrl, owner, repo, runId }) {
  const client = new DefaultArtifactClient();
  await client.uploadArtifact(ARTIFACT_NAME, listFiles(webDir), webDir);
  return `${serverUrl}/${owner}/${repo}/actions/runs/${runId}`;
}

module.exports = {
  decideTarget,
  publishToPages,
  uploadArtifactView,
  cleanupPages,
  pagesUrl,
  ARTIFACT_NAME,
};
