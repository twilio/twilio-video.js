#!/bin/sh
#
# hook script to verify what is about to be committed.
# Called by "git commit" with no arguments.  The hook should
# exit with non-zero status after issuing an appropriate message if
# it wants to stop the commit.
#

# Check 1: check for direct commit against protected branches.
# ------------------------------------------------------------
function validate_branch () {
    # notice current_branch evaluation only looks at part at the end of
    # so if you want to exclude feature/foo, list foo in the protected_branches

    PROTECTED_BRANCHES=('master' 'develop' 'support-1.x')
    CURRENT_BRANCH=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')
    echo current branch: $CURRENT_BRANCH
    for i in ${PROTECTED_BRANCHES[@]}; do
        if [ $i = $CURRENT_BRANCH ]
        then
            echo "You were about to commit to a forbidden branch: $i"
            echo "Commit aborted"
            exit 1;
        fi
    done
}

# Check 2: Ensure that you are not commiting any tests with marked .only
# ----------------------------------------------------------------------
function check_diffs () {
  FOLDER_PATTERN="$1"
  FILES_PATTERN="$2"
  FORBIDDEN="$3"
  FORBIDDEN_PRINTABLE="${4:-$3}"
  CHANGED_FILES=$(git diff --cached --name-only | egrep $FOLDER_PATTERN | egrep $FILES_PATTERN)

  OK=1
  for FILE in $CHANGED_FILES ; do
    git diff --cached --no-color -U0 $FILE | egrep '^\+[^\+]' | egrep -q "$FORBIDDEN"
    if [[ "$?" -eq 0 ]]; then
      OK=0
      echo "$FILE"
    fi
  done
  if [[ "$OK" -eq 0 ]]; then
    echo "COMMIT REJECTED: found '$FORBIDDEN_PRINTABLE' references. Please remove them before committing."
    exit 1
  fi
}

echo "Validating current branch..."
validate_branch

echo "Checking for .only..."
check_diffs 'test/unit/spec/' '\.js$' '\.only' '.only'

exit 0 # commit will  execute
