const core = require('@actions/core');
const { runRefactoringMiner } = require('./runner');
const { buildComment } = require('./formatter');
const { postOrUpdateComment } = require('./commenter');

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const image = core.getInput('image');
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const workspace = process.env.GITHUB_WORKSPACE;

    const data = await runRefactoringMiner(workspace, eventName, eventPath, image);
    const body = buildComment(data);

    if (eventName === 'pull_request') {
      await postOrUpdateComment(token, body, eventPath);
    } else {
      core.info(body);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
