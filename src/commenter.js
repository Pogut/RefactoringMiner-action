const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { COMMENT_HEADER } = require('./formatter');

async function postOrUpdateComment(token, body, eventPath) {
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const prNumber = event.pull_request.number;
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const octokit = getOctokit(token);

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existing = comments.find(c => c.body.startsWith(COMMENT_HEADER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

module.exports = { postOrUpdateComment, COMMENT_HEADER };
