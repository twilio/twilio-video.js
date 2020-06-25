#!/bin/sh
#
# hook script to verify what is about to be committed.
# Called by "git commit" with no arguments.  The hook should
# exit with non-zero status after issuing an appropriate message if
# it wants to stop the commit.
#

# Check 1: check for direct commit against protected branches.
# ------------------------------------------------------------
# notice current_branch evaluation only looks at part at the end of
# so if you want to exclude feature/foo, list foo in the protected_branches
echo validating commit...
protected_branches=('master' 'develop' 'support-1.x')
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')
echo current branch: $current_branch
for i in ${protected_branches[@]}; do
    if [ $i = $current_branch ]
    then
        echo "You were about to commit to a forbidden branch: $i"
        echo "Commit aborted"
        exit 1;
    fi
done

# Check 2: Ensure that you are not commiting any tests with marked .only
# ----------------------------------------------------------------------
FILES_PATTERN='\.(js)(\..+)?$'
FORBIDDEN='\.only'
git diff --cached --name-only | \
    grep -E $FILES_PATTERN | \
    GREP_COLOR='4;5;37;41' xargs grep --color --with-filename -n $FORBIDDEN && echo 'COMMIT REJECTED Found "$FORBIDDEN" references. Please remove them before commiting' && exit 1

exit 0 # commit will  execute
