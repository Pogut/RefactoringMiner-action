const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_IMAGE = 'tsantalis/refactoringminer:latest';
const CONTAINER_WORKSPACE = '/workspace';
const CONTAINER_OUTPUT = '/output';

/**
 * Pulls the RefactoringMiner Docker image, runs it against the checkout,
 * and returns the parsed JSON output.
 *
 * Uses mkdtempSync to create a private, uniquely-named temp directory
 * (mode 0700) rather than a static path under /tmp, avoiding symlink
 * attacks in a world-writable directory.
 */
async function runRefactoringMiner(workspace, eventName, eventPath, image = DEFAULT_IMAGE) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-'));

  try {
    core.info(`Pulling ${image}...`);
    await exec.exec('docker', ['pull', image]);

    const rmArgs = buildRmArgs(eventName, eventPath);
    core.info(`Running RefactoringMiner (${eventName})...`);

    await exec.exec('docker', [
      'run', '--rm',
      '-v', `${workspace}:${CONTAINER_WORKSPACE}`,
      '-v', `${tmpDir}:${CONTAINER_OUTPUT}`,
      '-e', 'GIT_CONFIG_COUNT=1',
      '-e', 'GIT_CONFIG_KEY_0=safe.directory',
      '-e', 'GIT_CONFIG_VALUE_0=*',
      image,
      ...rmArgs,
    ]);

    return JSON.parse(fs.readFileSync(path.join(tmpDir, 'refactorings.json'), 'utf8'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Returns the RefactoringMiner CLI args for the given event type.
 * Output is always written to CONTAINER_OUTPUT/refactorings.json.
 */
function buildRmArgs(eventName, eventPath) {
  const outFile = `${CONTAINER_OUTPUT}/refactorings.json`;

  if (eventName === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const baseSha = event.pull_request.base.sha;
    const headSha = event.pull_request.head.sha;
    return ['-bc', CONTAINER_WORKSPACE, baseSha, headSha, '-json', outFile];
  }

  const sha = process.env.GITHUB_SHA;
  return ['-c', CONTAINER_WORKSPACE, sha, '-json', outFile];
}

module.exports = { runRefactoringMiner, buildRmArgs };
