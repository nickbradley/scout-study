#!/bin/bash
REPO_DIR="$(readlink -f ../data/repos)"
echo "Cloning repos to ${REPO_DIR}"
cd "${REPO_DIR}"


while IFS= read -r url; do
    reponame=$(basename -- "$url")
    [ ! -d "$reponame" ] && git clone "$url"
done < ../repolist

chmod -R u=rX,go-rwx "${REPO_DIR}"