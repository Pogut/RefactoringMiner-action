# RefactoringMiner Action

A GitHub Action that detects refactorings in pull requests and posts a markdown summary as a PR comment.

Built on top of [RefactoringMiner](https://github.com/tsantalis/RefactoringMiner) by Nikolaos Tsantalis.

## Usage

Create `.github/workflows/refactorings.yml` in your repository:

```yaml
name: Refactoring Report
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: parsa/refactoringminer-action@v1
```

`fetch-depth: 0` is required so RefactoringMiner has full commit history for range analysis.

## Comment example

> ### RefactoringMiner Report
> Found 3 refactorings: 2 Extract Method, 1 Rename Variable
>
> - **Extract Method** — `computeTotal()` extracted from `checkout()` in `Cart.java`
> - **Extract Method** — `validateInput()` extracted from `submit()` in `FormHandler.java`
> - **Rename Variable** — `x` renamed to `itemCount` in `Inventory.java`

## Inputs

| Input | Description | Default |
|---|---|---|
| `github-token` | Token used to post the PR comment | `${{ github.token }}` |

## How it works

1. On `pull_request` events, runs `refactoringminer -bc` across the commit range from base to head.
2. On `push` events, runs `refactoringminer -c` against the pushed commit and logs the result.
3. Parses the JSON output and posts a grouped summary as a PR comment.

## Requirements

- Linux runners only (`ubuntu-latest` recommended). The Docker container action does not run on Windows or macOS hosted runners.
