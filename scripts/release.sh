#!/bin/bash
set -e

name=twilio-conversations

function die() {
  echo "Error: $1" 1>&2
  exit 1
}

function get_version() {
  json=$1
  sed -n 's/^  "version": "\(.*\)",$/\1/gp' ${json}
}

function update_version() {
  local json=$1
  local old_version=$2
  local new_version=$3
  if [[ $(get_version ${json}) != ${old_version} ]]; then
    die "Saw unexpected version number in ${json}"
  fi
  sed -e "s/^  \"version\": \"${old_version}\",/  \"version\": \"${new_version}\",/" -i '.backup' ${json}
  written_version=$(get_version ${json})
  if [[ ${written_version} != ${new_version} ]]; then
    die "Something went wrong writing the version to ${json}"
  fi
  rm ${json}.backup
}

# Ensure there are no uncommitted changes.
if ! git diff --quiet && git diff --cached --quiet; then
  die "You have uncommitted changes"
fi

# Get the current version from package.json.
current=$(get_version package.json)
if [[ -z ${current} ]]; then
  die "Couldn't get the version number"
fi

# Parse the current version.
major=$(echo ${current} | cut -d . -f 1)
minor=$(echo ${current} | cut -d . -f 2)
patch=$(echo ${current} | cut -d . -f 3 | grep -o '^[0-9]*')
suffix=$(echo ${current} | cut -d . -f 3 | sed 's/^[0-9]*//')
if [[ -z ${major} || -z ${minor} || -z ${patch} || ${major}.${minor}.${patch}${suffix} != ${current} ]]; then
  die "Couldn't parse the version number"
fi

echo "Current Version: ${current}"

# Compute the release version.
if [[ ${suffix} == '-dev' ]]; then
  dev=1
  release=${major}.${minor}.${patch}
else
  dev=0
  next_patch=$(echo "${patch} + 1" | bc)
  release=${major}.${minor}.${next_patch}
fi

# Override the release version.
echo -n "Release Version [${release}]: "
read override_release
if [[ ! -z ${override_release} ]]; then
  release=${override_release}
fi

# Parse the release version.
release_major=$(echo ${release} | cut -d . -f 1)
release_minor=$(echo ${release} | cut -d . -f 2)
release_patch=$(echo ${release} | cut -d . -f 3 | grep -o '^[0-9]*')
release_suffix=$(echo ${release} | cut -d . -f 3 | sed 's/^[0-9]*//')
if [[ -z ${release_major} || -z ${release_minor} || -z ${release_patch} || ${release_major}.${release_minor}.${release_patch}${release_suffix} != ${release} ]]; then
  die "Invalid release version"
fi

# Ensure the release version is greater than the current version.
release_major_gt=$(echo "${release_major} > ${major}" | bc)
release_minor_gt=$(echo "${release_minor} > ${minor}" | bc)
release_patch_gt=$(echo "${release_patch} > ${patch}" | bc)
release_gt=$(echo "${release_major_gt} + ${release_minor_gt} + ${release_patch_gt}" | bc)
if [[ ${dev} == 0 && ${release_gt} == 0 ]]; then
  die "Release version must be greater than the current version"
fi

# Compute the next development version.
next_patch=$(echo "${release_patch} + 1" | bc)
next=${release_major}.${release_minor}.${next_patch}-dev

# Override the next development version.
echo -n "Next Development Version [${next}]:"
read override_next
if [[ ! -z ${override_next} ]]; then
  next=${override_next}
fi

# Parse the next development version.
next_major=$(echo ${next} | cut -d . -f 1)
next_minor=$(echo ${next} | cut -d . -f 2)
next_patch=$(echo ${next} | cut -d . -f 3 | grep -o '^[0-9]*')
next_suffix=$(echo ${next} | cut -d . -f 3 | sed 's/^[0-9]*//')
if [[ -z ${next_major} || -z ${next_minor} || -z ${next_patch} || ${next_major}.${next_minor}.${next_patch}${next_suffix} != ${next} ]]; then
  die "Invalid next development version"
fi

# Ensure the next development version is greater than the release version.
next_major_gt=$(echo "${next_major} > ${release_major}" | bc)
next_minor_gt=$(echo "${next_minor} > ${release_minor}" | bc)
next_patch_gt=$(echo "${next_patch} > ${release_patch}" | bc)
next_gt=$(echo "${next_major_gt} + ${next_minor_gt} + ${next_patch_gt}" | bc)
if [[ ${next_gt} == 0 ]]; then
  die "Next development version must be greater than the release version"
fi

# Update the version in package.json and bower.json.
for json in package.json bower.json; do
  update_version ${json} ${current} ${release}
  git add ${json}
done

git rm -rf --ignore-unmatch dist
gulp clean
gulp
git add -f dist/${name}.js dist/${name}.min.js dist/docs
git commit -m ${release}
git tag ${release}
git push origin master --tags

# Update the version in package.json and bower.json.
for json in package.json bower.json; do
  update_version ${json} ${release} ${next}
  git add ${json}
done

git rm -rf dist
gulp clean
git commit -m ${next}
git push origin master
