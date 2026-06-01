#!/usr/bin/env bash
set -euo pipefail

GITHUB_TOKEN="${1:-${GITHUB_TOKEN:-}}"
OUT=/tmp/refactorings.json

# ---------------------------------------------------------------------------
# 1. Run RefactoringMiner against the checkout
# ---------------------------------------------------------------------------
if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]]; then
  BASE_SHA=$(jq -r '.pull_request.base.sha' "$GITHUB_EVENT_PATH")
  HEAD_SHA=$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")
  refactoringminer -bc "$GITHUB_WORKSPACE" "$BASE_SHA" "$HEAD_SHA" -json "$OUT"
else
  refactoringminer -c "$GITHUB_WORKSPACE" "$GITHUB_SHA" -json "$OUT"
fi

# ---------------------------------------------------------------------------
# 2. Build a markdown comment body from the JSON output
# ---------------------------------------------------------------------------
COUNT=$(jq '[.commits[].refactorings[]] | length' "$OUT")

if [[ "$COUNT" -eq 0 ]]; then
  BODY="### RefactoringMiner Report
No refactorings detected in this change."
else
  BREAKDOWN=$(jq -r '
    [.commits[].refactorings[].type]
    | group_by(.)
    | map("\(length) \(.[0])")
    | join(", ")
  ' "$OUT")

  DETAILS=$(jq -r '
    .commits[].refactorings[]
    | "- **\(.type)** — \(.description)"
  ' "$OUT")

  BODY=$(printf '### RefactoringMiner Report\nFound %s refactorings: %s\n\n%s' \
    "$COUNT" "$BREAKDOWN" "$DETAILS")
fi

# ---------------------------------------------------------------------------
# 3. Post the comment
#    Push events: just log the body (no PR to comment on).
#    TODO: update an existing bot comment instead of posting a new one.
# ---------------------------------------------------------------------------
if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]]; then
  PR_NUMBER=$(jq -r '.pull_request.number' "$GITHUB_EVENT_PATH")
  jq -n --arg body "$BODY" '{body: $body}' \
    | curl -sS --fail-with-body \
        -X POST \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
        -d @-
else
  echo "$BODY"
fi
