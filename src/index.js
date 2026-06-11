const core = require('@actions/core');
const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { runRefactoringMiner } = require('./runner');
const { exportWebDiff } = require('./exporter');
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
    const workspace = process.env.GITHUB_WORKSPACE;
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

    const data = await runRefactoringMiner(workspace, eventName, eventPath, image);

    let view;
    if (enableWebView && eventName === 'pull_request') {
      view = await buildView({ octokit, token, serverUrl, owner, repo, runId, image, eventName, eventPath, event });
    }

    const prNumber = eventName === 'pull_request' ? event.pull_request.number : undefined;
    const body = buildComment(data, view, { serverUrl, owner, repo, prNumber });

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
 * Exports the interactive diff and publishes it (Pages or artifact), returning
 * a `{ url, kind }` view descriptor. Any failure here is non-fatal: it logs a
 * warning and returns undefined so the summary comment is still posted.
 */
async function buildView({ octokit, token, serverUrl, owner, repo, runId, image, eventName, eventPath, event }) {
  try {
    const webDir = await exportWebDiff(eventName, eventPath, image, token);
    const prNumber = event.pull_request.number;
    const sha = event.pull_request.head.sha;
    const isPrivate = event.repository.private;

    const target = await decideTarget(octokit, owner, repo, isPrivate);
    if (target === 'pages') {
      const url = await publishToPages({ octokit, token, serverUrl, owner, repo, webDir, prNumber, sha });
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
