# RefactoringMiner Action

A GitHub Action that detects refactorings in pull requests, posts a markdown summary as a PR comment, and links reviewers to RefactoringMiner's **interactive AST-diff view**.

Built on top of [RefactoringMiner](https://github.com/tsantalis/RefactoringMiner) by Nikolaos Tsantalis.

## Usage

Create `.github/workflows/refactorings.yml` in your repository:

```yaml
name: Refactoring Report
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: write        # publish the interactive view to gh-pages
  pages: write           # enable GitHub Pages on first run
  pull-requests: write   # post the PR comment

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: Pogut/refactoringminer-action@v1
```

- `fetch-depth: 0` is required so RefactoringMiner has full commit history for range analysis.
- The `closed` trigger type lets the action clean up a PR's published diffs when it closes. It's optional but recommended.
- If you only want the summary comment (no interactive view), set `enable-web-view: false` and you can drop the `contents: write` / `pages: write` permissions.

## Comment example

> ### RefactoringMiner Report
> Found 3 refactorings: 2 Extract Method, 1 Rename Variable
>
> - **Extract Method** — `computeTotal()` extracted from `checkout()` in `Cart.java`
> - **Extract Method** — `validateInput()` extracted from `submit()` in `FormHandler.java`
> - **Rename Variable** — `x` renamed to `itemCount` in `Inventory.java`
>
> 🔍 **[View the interactive diff](#)** _(first run may take ~1 min to go live)_

## The interactive diff view

Alongside the summary, the action exports RefactoringMiner's interactive Monaco AST-diff view (a self-contained static site) and links it from the comment. Where it's hosted depends on the repository:

| Repository | GitHub Pages | Behavior |
|---|---|---|
| Public | unused, or already served from `gh-pages` | Published to `gh-pages` under `refactorings/pr-<n>/<sha>/`; comment links to it |
| Public | already serving your own site from another source | Uploaded as a workflow **artifact**; comment links to the run |
| Private | — | Uploaded as a workflow **artifact**; comment links to the run |

This keeps private source code off public URLs and never clobbers an existing Pages site.

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `github-token` | Token used to post the comment and publish the view. | No | `${{ github.token }}` |
| `image` | RefactoringMiner Docker image to run (e.g. `tsantalis/refactoringminer:3.0.9`). | No | `tsantalis/refactoringminer:latest` |
| `enable-web-view` | Export and link the interactive AST-diff view. Set `false` for summary only. | No | `true` |

## How it works

1. On `pull_request` events, runs `refactoringminer -bc` across the commit range (base→head) for the summary.
2. With `enable-web-view`, runs `refactoringminer diff --url <pr-url> -e` to export the interactive view, then publishes it (Pages or artifact) and links it in the comment.
3. On `push` events, runs `refactoringminer -c` against the pushed commit and logs the summary.
4. When a PR is closed, removes its published diffs from `gh-pages`.

## Requirements

- **Linux runners only** (`ubuntu-latest` recommended). This Docker container action does not run on Windows or macOS hosted runners.
- A checkout with full history (`fetch-depth: 0`).

## License

See [LICENSE](LICENSE).
