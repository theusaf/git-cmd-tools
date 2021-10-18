#!/usr/bin/env bash

ARG_OPTS=pf
LONGOPTS=push,force

PARSED=$(getopt --options=$OPTIONS --longoptions=$LONGOPTS --name "$0" -- "$@")
eval set -- "$PARSED"

force=n
push=n

while true; do
    case "$1" in
	-f|--force)
	    force=y
	    shift
	    ;;
	-p|--push)
	    push=y
	    shift
	    ;;
	--)
	    shift
	    break
	    ;;
	*)
	    exit 3
	    ;;
    esac
done

COMMIT_OUTPUT=$((git add .) 2>&1)
if [[ "$COMMIT_OUTPUT" =~ "fatal:" ]]; then
  echo "$COMMIT_OUTPUT"
  exit 1
fi
REMOTE=$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)")
IFS="/"
N=0
BRANCH=''
ORIGIN=''
read -ra ADDR <<< "$REMOTE"
for i in "${ADDR[@]}"; do
    if [ "$N" = 0 ]; then
	ORIGIN="$i"
    else
	BRANCH="$i"
    fi
done
git commit -m "$1"
if [ "$push" = "y" ]; then
    if [ "$force" = "y" ]; then
	git push "$ORIGIN" "$BRANCH" --force
    else
	git push "$ORIGIN" "$BRANCH"
    fi
fi
