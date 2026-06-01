const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

const IMAGE = 'tsantalis/refactoringminer:latest';
const OUTPUT_DIR = '/tmp/rm-output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'refactorings.json');
const CONTAINER_WORKSPACE = '/workspace';
const CONTAINER_OUTPUT = '/output';

/**
 * Pulls the RefactoringMiner Docker image, runs it against the checkout,
 * and returns the parsed JSON output.
 */
async function runRefactoringMiner(workspace, eventName, eventPath) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  core.info(`Pulling ${IMAGE}...`);
  await exec.exec('docker', ['pull', IMAGE]);

  const rmArgs = buildRmArgs(eventName, eventPath);
  core.info(`Running RefactoringMiner (${eventName})...`);

  await exec.exec('docker', [
    'run', '--rm',
    '-v', `${workspace}:${CONTAINER_WORKSPACE}`,
    '-v', `${OUTPUT_DIR}:${CONTAINER_OUTPUT}`,
    IMAGE,
    ...rmArgs,
  ]);

  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
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
