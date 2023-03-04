#!/bin/bash

set -e

url="$2"

if [[ "$url" != *"gitlab-org/security/"* ]]
then
  echo "Pushing to remotes other than gitlab.com/gitlab-org/security has been disabled!"
  echo "Run scripts/security-harness to disable this check."
  echo

  exit 1
fi
