# Need to be authenticated as an admin
gh repo list prentic --limit 1000 --json createdAt,updatedAt,name --jq '.[] | if (.updatedAt | fromdate) - (.createdAt | fromdate) < 60 then .name else "" end' | 
while read -r repo;
do
  # Skip repos which were updated more than 1 minute after when the repo was created
  [ -z "$repo" ] && continue;
  # Skip repos that are in our list
  [ $(grep "$repo" ../data/repolist) ] && continue;
  # Skip repos with more than one commit
  [ $(gh api repos/prentic/$repo/commits --jq '. | length') -gt "1" ] && continue;
  gh repo delete prentic/$repo --confirm
done