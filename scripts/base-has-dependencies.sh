#!/usr/bin/env sh
set -eu

base_sha="${1:?base commit SHA is required}"
manifests='(^|/)(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|Gemfile\.lock|go\.(mod|sum)|pom\.xml|build\.gradle(\.kts)?|requirements[^/]*\.txt|poetry\.lock|Pipfile\.lock|Cargo\.(toml|lock)|composer\.lock|packages\.lock\.json)$'

if git ls-tree -r --name-only "$base_sha" | grep -Eq "$manifests"; then
  printf 'true\n'
else
  printf 'false\n'
fi
