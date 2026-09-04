# RefactoringMiner Action

Detects refactorings in a pull request, posts a grouped markdown summary as a PR comment, and links reviewers to RefactoringMiner's **interactive AST-diff view**.

Built on [RefactoringMiner](https://github.com/tsantalis/RefactoringMiner) by Nikolaos Tsantalis.

## Quick start

Create `.github/workflows/refactorings.yml` in your repository:

```yaml
name: Refactoring Report

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: write        # publish the interactive diff to the gh-pages branch
  pages: write           # enable GitHub Pages on the first run
  pull-requests: write   # post the summary comment

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: Pogut/RefactoringMiner-action@v1
```

That is the entire workflow — note there is **no `actions/checkout` step**. RefactoringMiner is handed the pull request's URL and the job's token and reads the diff from GitHub directly, so nothing is read from the runner's filesystem. Adding a checkout (especially `fetch-depth: 0`) only costs you clone time.

Keep `closed` in `types:`. When a pull request closes, the action removes that PR's published diff from the `gh-pages` branch instead of leaving it behind forever.

### Permissions

| Permission | Why it is needed |
|---|---|
| `pull-requests: write` | Post the summary comment, and delete the previous one. |
| `contents: write` | Push the exported diff to `gh-pages`, and remove it when the PR closes. |
| `pages: write` | Attempt to turn GitHub Pages on during the first run. |

If you want the comment only, set `enable-web-view: 'false'` and `contents: read` with no `pages:` permission is enough.

## What you get

A single comment on the pull request:

> ### RefactoringMiner Report
> Found 4 refactorings: 2 Extract Method, 1 Rename Parameter, 1 Move Attribute
>
> - **Extract Method** [private calculateTotal(unitPrice Int, quantity Int) : Int](#) extracted from [public buildReceipt(buyerName String, unitPrice Int) : String](#) in class `OrderProcessor`
> - **Rename Parameter** [customerName : String](#) to [buyerName : String](#) in method `public buildReceipt(...)` from class `OrderProcessor`
> - **Move Attribute** [private street : String](#) from class `CustomerProfile` to [private street : String](#) from class `Address`
>
> 🔍 **[View the interactive diff](#)** _(first run may take ~1 min to go live)_

Every code element is a link to the exact line in the PR's diff — RefactoringMiner generates those links itself, so they land on the right side of the split view.

When nothing is found, the comment reads _"No refactorings detected in this change."_

On each new push to the PR, the previous report is deleted and a fresh one posted, so the report always sits at the bottom of the conversation rather than staying pinned where it was first added.

## The interactive diff view

Alongside the comment, the action exports RefactoringMiner's full AST-diff web view and publishes it to **GitHub Pages**, under `refactorings/pr-<number>/` on your `gh-pages` branch.

### One-time Pages setup

The default `GITHUB_TOKEN` is not allowed to enable Pages, so the first run pushes the diff to `gh-pages` and then warns you to finish the setup by hand. Do this once:

**Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, branch **`gh-pages`**, folder **`/ (root)`**.

After that every run links straight to the published view.

### When it falls back to an artifact

If Pages can't be used, the view is uploaded as a workflow artifact named `refactoring-diff` and the comment links to the run instead. Download it and open `web/list/index.html`. This happens when:

- **the repository is private** — Pages sites would be public, so the action never publishes one for you; or
- **Pages is configured to build some other way** — for example Source set to "GitHub Actions", or serving from a different branch. The action will not reconfigure a Pages site you set up yourself.

If you are getting the artifact link and expected the published view, check the Source setting above — that is almost always the cause.

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `github-token` | Token used to post the PR comment and publish the view. | No | `${{ github.token }}` |
| `image` | RefactoringMiner Docker image to run. Pin a specific tag for reproducible results. | No | `tsantalis/refactoringminer:latest` |
| `enable-web-view` | Export and publish the interactive AST-diff view. Set to `'false'` for comment-only runs. | No | `'true'` |

### Pinning the RefactoringMiner version

```yaml
      - uses: Pogut/RefactoringMiner-action@v1
        with:
          image: tsantalis/refactoringminer:3.0.9
```

The image must be recent enough to write `jsons/refactorings.json` on `--export`; the action fails with a clear message if it isn't.

## How it works

1. On a `pull_request` event, the action runs `refactoringminer diff --url <pr-url> -e` inside the RefactoringMiner Docker image. That single run produces both the interactive web view and `jsons/refactorings.json`.
2. The comment is rendered from that JSON's `markup` field, which already carries GitHub deep links for every code element.
3. The exported view is published to `gh-pages` or uploaded as an artifact, and linked at the bottom of the comment.
4. When the PR closes, its published diff is deleted from `gh-pages`.
5. On other events the report is written to the workflow log instead of being posted as a comment.

The Docker image is pulled automatically — you do not need Java, RefactoringMiner, or any Docker setup of your own on the runner.

## Requirements

- **Linux runners only** (`ubuntu-latest` recommended). The action shells out to `docker run`, which hosted Windows and macOS runners do not provide.
- A **public repository** for the published Pages view. Private repositories still get the full view as a workflow artifact.

## Supported languages

Whatever the pinned RefactoringMiner image supports. Refactoring detection and AST-diff generation are both available for **Java, Python, Kotlin, TypeScript and JavaScript**; C++ parsing is in progress and not yet supported. See the [RefactoringMiner README](https://github.com/tsantalis/RefactoringMiner) for the authoritative, up-to-date table.

## License

GPL-3.0 — see [LICENSE](LICENSE). RefactoringMiner itself is developed and licensed separately by [Nikolaos Tsantalis and contributors](https://github.com/tsantalis/RefactoringMiner).
