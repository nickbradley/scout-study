SOURCE_DIR=/home/ncbradley/Sync/yatm
TARGET_DIR=/home/ncbradley/Sync/yatm-template
REMOTE_REPO=git@github.com:prentic/yatm-template

cd "${SOURCE_DIR}"
git checkout main

read -p "Delete path '${TARGET_DIR}'? [y/N] " yn && [ "${yn}" = 'y' ] && rm -rf "${TARGET_DIR}"
echo "Stale local copy removed. Copying ${SOURCE_DIR} to ${TARGET_DIR}"
#cp -r "${SOURCE_DIR}" "${TARGET_DIR}"
rsync -a --progress "${SOURCE_DIR}/" "${TARGET_DIR}"
echo "Copy complete. Running git operations"

cd "${TARGET_DIR}"
rm -rf .git
git init
# This line doesn't actually do anything since the config is not pushed to remote
# Instead, run it in .devcontainer.json
# I'll leave it here for local testing
git config --local commit.template .git/commitmsg.txt
echo "Task 0" > .git/commitmsg.txt
git add --all
git commit -m "Initial commit"
git remote add origin "${REMOTE_REPO}"
git push --force -u origin main
