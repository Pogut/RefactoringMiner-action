const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { COMMENT_HEADER } = require('./formatter');

/**
 * Posts a new PR comment, or updates the existing bot comment if one is found.
 * TODO: implement find-and-update logic (PATCH instead of POST when
 *   a prior comment whose body starts with COMMENT_HEADER already exists).
 * 
 */
async function postOrUpdateComment(token, body, eventPath) {
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const prNumber = event.pull_request.number;
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const octokit = getOctokit(token);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

module.exports = { postOrUpdateComment, COMMENT_HEADER };
