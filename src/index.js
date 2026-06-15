const core = require('@actions/core');
const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { exportDiff } = require('./exporter');
const { buildComment } = require('./formatter');
const { postOrUpdateComment } = require('./commenter');
const { decideTarget, publishToPages, uploadArtifactView, cleanupPages } = require('./publisher');

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const image = core.getInput('image');
    const enableWebView = (core.getInput('enable-web-view') || 'true') !== 'false';

    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const runId = process.env.GITHUB_RUN_ID;
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const octokit = getOctokit(token);

    // A closed PR: remove its published diffs and stop.
    if (eventName === 'pull_request' && event.action === 'closed') {
      await cleanupPages({ token, serverUrl, owner, repo, prNumber: event.pull_request.number });
      return;
    }

    // One RefactoringMiner call produces everything we need: the interactive web
    // diff AND the refactorings JSON whose `markup` is already linked to the
    // exact GitHub diff lines. No separate commit-analysis run.
    const { webDir, refactorings } = await exportDiff(eventName, eventPath, image, token);

    let view;
    if (enableWebView && eventName === 'pull_request') {
      view = await publishView({ octokit, token, serverUrl, owner, repo, runId, webDir, event });
    }

    const body = buildComment(refactorings, view);

    if (eventName === 'pull_request') {
      await postOrUpdateComment(token, body, eventPath, octokit);
    } else {
      core.info(body);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

/**
 * Publishes the already-exported web view (Pages or artifact) and returns a
 * `{ url, kind }` view descriptor. Any failure here is non-fatal: it logs a
 * warning and returns undefined so the summary comment is still posted.
 */
async function publishView({ octokit, token, serverUrl, owner, repo, runId, webDir, event }) {
  try {
    const prNumber = event.pull_request.number;
    const isPrivate = event.repository.private;

    const target = await decideTarget(octokit, owner, repo, isPrivate);
    if (target === 'pages') {
      const url = await publishToPages({ octokit, token, serverUrl, owner, repo, webDir, prNumber });
      return { url, kind: 'pages' };
    }

    const url = await uploadArtifactView({ webDir, serverUrl, owner, repo, runId });
    return { url, kind: 'artifact' };
  } catch (error) {
    core.warning(`Interactive diff view unavailable: ${error.message}`);
    return undefined;
  }
}

run();
