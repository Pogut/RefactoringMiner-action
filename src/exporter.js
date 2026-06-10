const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_IMAGE = 'tsantalis/refactoringminer:latest';
const CONTAINER_EXPORT = '/diff/exported';
const RM_JAR = '/opt/refactoringminer/lib/RefactoringMiner-DockerBuild.jar';

/**
 * Builds the GitHub URL that RefactoringMiner's `diff --url` mode analyzes.
 * Prefers the PR's html_url from the event payload; otherwise constructs a
 * commit URL from the standard GitHub Actions environment.
 */
function buildAnalysisUrl(eventName, eventPath) {
  if (eventName === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    return event.pull_request.html_url;
  }

  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  return `${server}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
}

/**
 * Exports RefactoringMiner's interactive AST-diff web view as a self-contained
 * static site and returns the path to the generated `web/` directory.
 *
 * Mirrors the proven recipe from EmpiricalSEConcordia/Refactoringminer-Astdiff-Exporter:
 * `refactoringminer diff --url <url> -e` writes the diff pages, and the Monaco
 * editor + JS/CSS resources are copied out of the image's jar into web/resources.
 *
 * The temp directory is created with mkdtempSync (mode 0700) for the same
 * symlink-safety reason as runner.js.
 */
async function exportWebDiff(eventName, eventPath, image = DEFAULT_IMAGE, token = '') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-web-'));
  const url = buildAnalysisUrl(eventName, eventPath);

  core.info(`Exporting interactive diff for ${url}...`);
  await exec.exec('docker', [
    'run', '--rm',
    '--env', `OAuthToken=${token}`,
    '-v', `${tmpDir}:${CONTAINER_EXPORT}`,
    '--entrypoint', '/bin/sh',
    image,
    '-c',
    `refactoringminer diff --url "${url}" -e && ` +
      `unzip -o ${RM_JAR} -d /tmp/rm > /dev/null && ` +
      `mkdir -p ${CONTAINER_EXPORT}/web && ` +
      `cp -r /tmp/rm/web ${CONTAINER_EXPORT}/web/resources`,
  ]);

  const webDir = path.join(tmpDir, 'web');
  if (!fs.existsSync(path.join(webDir, 'list', 'index.html'))) {
    throw new Error(`Expected exported web view at ${webDir} was not produced`);
  }

  return webDir;
}

module.exports = { exportWebDiff, buildAnalysisUrl };
