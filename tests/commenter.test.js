jest.mock('@actions/github', () => ({ getOctokit: jest.fn() }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

const { getOctokit } = require('@actions/github');
const fs = require('fs');
const { postOrUpdateComment } = require('../src/commenter');
const { COMMENT_HEADER } = require('../src/formatter');

const mockCreateComment = jest.fn().mockResolvedValue({});
const mockUpdateComment = jest.fn().mockResolvedValue({});
const mockDeleteComment = jest.fn().mockResolvedValue({});
const mockListComments = jest.fn();

describe('postOrUpdateComment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GITHUB_REPOSITORY: 'owner/repo' };

    getOctokit.mockReturnValue({
      rest: {
        issues: {
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
          deleteComment: mockDeleteComment,
          listComments: mockListComments,
        },
      },
    });

    fs.readFileSync.mockReturnValue(
      JSON.stringify({ pull_request: { number: 42 } })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when no existing bot comment exists', () => {
    beforeEach(() => {
      mockListComments.mockResolvedValue({ data: [] });
    });

    test('creates a new comment and deletes nothing', async () => {
      await postOrUpdateComment('token', 'test body', '/fake/event.json');

      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
        body: 'test body',
      });
      expect(mockDeleteComment).not.toHaveBeenCalled();
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
      const body = `${COMMENT_HEADER}\nFound 2 refactorings: 2 Extract Method`;
      await postOrUpdateComment('token', body, '/fake/event.json');

      expect(mockCreateComment).toHaveBeenCalledWith(
        expect.objectContaining({ body })
      );
    });

    test('fetches up to 100 comments per page', async () => {
      await postOrUpdateComment('token', 'body', '/fake/event.json');

      expect(mockListComments).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 100 })
      );
    });
  });

  describe('when an existing bot comment exists', () => {
    const existingCommentId = 777;

    beforeEach(() => {
      mockListComments.mockResolvedValue({
        data: [
          { id: 123, body: 'some other comment' },
          { id: existingCommentId, body: `${COMMENT_HEADER}\nOld content` },
        ],
      });
    });

    test('deletes the old comment and posts a fresh one at the bottom', async () => {
      const newBody = `${COMMENT_HEADER}\nFound 3 refactorings`;
      await postOrUpdateComment('token', newBody, '/fake/event.json');

      expect(mockDeleteComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        comment_id: existingCommentId,
      });
      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
        body: newBody,
      });
      expect(mockUpdateComment).not.toHaveBeenCalled();
    });

    test('matches the bot comment by COMMENT_HEADER prefix', async () => {
      mockListComments.mockResolvedValue({
        data: [{ id: 99, body: `${COMMENT_HEADER}\nSomething` }],
      });

      await postOrUpdateComment('token', 'new body', '/fake/event.json');

      expect(mockDeleteComment).toHaveBeenCalledWith(
        expect.objectContaining({ comment_id: 99 })
      );
    });
  });
});
