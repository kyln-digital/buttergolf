#!/usr/bin/env bash
# Classify a PR as Class A (maintenance) or Class B (review).
# Rules (KYL-1292 merge-policy): mechanical — author + size + paths only.
set -euo pipefail

: "${GH_TOKEN:?}"
: "${GH_REPO:?}"
: "${PR_NUMBER:?}"
: "${HUMAN_REVIEWER:=Josh-moreton}"
: "${MAX_LINES:=150}"
: "${MAX_FILES:=10}"

# Product / infra / secrets paths → always Class B for non-bot authors.
PROTECTED_REGEX='(^|/)\.github/workflows/|(^|/)\.github/actions/|(^|/)\.github/CODEOWNERS|(^|/)\.github/l0-merge-policy/|(^|/)Dockerfile|(^|/)docker-compose|\.tf$|(^|/)infra/|(^|/)cdk/|(^|/)terraform/|(^|/)migrations/|(^|/)drizzle/|(^|/)\.env|(^|/)secrets/|(^|/)auth/|(^|/)payments/|(^|/)stripe/|(^|/)app/|(^|/)src/|(^|/)components/|(^|/)lib/|(^|/)packages/|(^|/)apps/'

pr_json="$(gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}")"
author="$(printf '%s' "$pr_json" | jq -r '.user.login')"
author_type="$(printf '%s' "$pr_json" | jq -r '.user.type')"
additions="$(printf '%s' "$pr_json" | jq -r '.additions')"
deletions="$(printf '%s' "$pr_json" | jq -r '.deletions')"
changed_files="$(printf '%s' "$pr_json" | jq -r '.changed_files')"
lines=$((additions + deletions))

files_json="$(gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}/files" --paginate)"
paths="$(printf '%s' "$files_json" | jq -r '.[].filename')"

is_bot=0
if [[ "$author_type" == "Bot" ]] || [[ "$author" == *\[bot\] ]] || [[ "$author" =~ ^(dependabot|renovate) ]]; then
  is_bot=1
fi

hits_protected=0
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if [[ "$path" =~ $PROTECTED_REGEX ]]; then
    hits_protected=1
    break
  fi
done <<< "$paths"

class="B"
label="class:review"
reason="default Class B"

if [[ "$is_bot" -eq 1 ]]; then
  class="A"
  label="class:maintenance"
  reason="bot author (${author})"
elif [[ "$lines" -le "$MAX_LINES" && "$changed_files" -le "$MAX_FILES" && "$hits_protected" -eq 0 ]]; then
  class="A"
  label="class:maintenance"
  reason="within caps (${lines} lines / ${changed_files} files) and no protected paths"
else
  if [[ "$hits_protected" -eq 1 ]]; then
    reason="protected path(s) touched"
  elif [[ "$lines" -gt "$MAX_LINES" || "$changed_files" -gt "$MAX_FILES" ]]; then
    reason="over size caps (${lines} lines / ${changed_files} files; max ${MAX_LINES}/${MAX_FILES})"
  fi
fi

# Ensure labels exist, then swap class labels.
ensure_label() {
  local name="$1" color="$2" desc="$3"
  if ! gh label list --repo "$GH_REPO" --search "$name" --json name --jq '.[].name' | grep -Fxq "$name"; then
    gh label create "$name" --repo "$GH_REPO" --color "$color" --description "$desc" || true
  fi
}

ensure_label "class:maintenance" "0E8A16" "Class A — auto-merge eligible (L0 merge policy)"
ensure_label "class:review" "B60205" "Class B — human merge required (L0 merge policy)"

gh api -X DELETE "repos/${GH_REPO}/issues/${PR_NUMBER}/labels/class%3Amaintenance" 2>/dev/null || true
gh api -X DELETE "repos/${GH_REPO}/issues/${PR_NUMBER}/labels/class%3Areview" 2>/dev/null || true
gh api -X POST "repos/${GH_REPO}/issues/${PR_NUMBER}/labels" \
  -f "labels[]=${label}" >/dev/null

if [[ "$class" == "B" ]]; then
  # Request human reviewer; ignore if already requested or self-review blocked.
  gh api -X POST "repos/${GH_REPO}/pulls/${PR_NUMBER}/requested_reviewers" \
    -f "reviewers[]=${HUMAN_REVIEWER}" >/dev/null 2>&1 || true
fi

{
  echo "class=${class}"
  echo "label=${label}"
  echo "reason=${reason}"
} >> "${GITHUB_OUTPUT:-/dev/null}"

echo "::notice::merge-class → ${class} (${label}): ${reason}"
