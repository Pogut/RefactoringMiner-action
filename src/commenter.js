const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { COMMENT_HEADER } = require('./formatter');

async function postOrUpdateComment(token, body, eventPath, octokit = getOctokit(token)) {
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const prNumber = event.pull_request.number;
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find(c => c.body.startsWith(COMMENT_HEADER));

  // Delete the previous report and post a fresh one, so the comment always
  // lands at the bottom of the conversation (the newest event) rather than
  // staying pinned to wherever it was first posted. Updating in place would
  // keep its original timeline position and force scrolling up to find it.
  if (existing) {
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: existing.id,
    });
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

module.exports = { postOrUpdateComment, COMMENT_HEADER };
