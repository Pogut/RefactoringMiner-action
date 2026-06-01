jest.mock('@actions/github');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { postOrUpdateComment } = require('../src/commenter');

const mockCreateComment = jest.fn().mockResolvedValue({});

describe('postOrUpdateComment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GITHUB_REPOSITORY: 'owner/repo' };

    getOctokit.mockReturnValue({
      rest: { issues: { createComment: mockCreateComment } },
    });

    fs.readFileSync.mockReturnValue(
      JSON.stringify({ pull_request: { number: 42 } })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('posts a comment to the correct PR number', async () => {
    await postOrUpdateComment('token', 'test body', '/fake/event.json');

    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42,
      body: 'test body',
    });
  });

  test('authenticates with the provided token', async () => {
    await postOrUpdateComment('my-secret-token', 'body', '/fake/event.json');
    expect(getOctokit).toHaveBeenCalledWith('my-secret-token');
  });

  test('splits owner and repo from GITHUB_REPOSITORY', async () => {
    process.env.GITHUB_REPOSITORY = 'myorg/myrepo';
    await postOrUpdateComment('token', 'body', '/fake/event.json');

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'myorg', repo: 'myrepo' })
    );
  });

  test('reads the PR number from the event file', async () => {
    fs.readFileSync.mockReturnValue(
      JSON.stringify({ pull_request: { number: 99 } })
    );
    await postOrUpdateComment('token', 'body', '/event.json');

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 99 })
    );
  });

  test('passes the comment body through unchanged', async () => {
    const body = '### RefactoringMiner Report\nFound 2 refactorings: 2 Extract Method';
    await postOrUpdateComment('token', body, '/fake/event.json');

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ body })
    );
  });
});
