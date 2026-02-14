import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';

async function getGitHubClient() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN not set');
  return new Octokit({ auth: token });
}

const OWNER = 'JAcobNFA';
const REPO = 'jacob-nfa';

const IGNORE = new Set(['.git', 'node_modules', '.cache', 'artifacts', 'cache', '.local', '.config', 'typechain-types', '.upm']);

function getAllFiles(dir, base = '') {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, relPath));
    } else {
      results.push({ path: relPath, fullPath });
    }
  }
  return results;
}

async function main() {
  const octokit = await getGitHubClient();
  
  // Get the authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  // Get default branch and latest commit
  let repo;
  try {
    const resp = await octokit.repos.get({ owner: OWNER, repo: REPO });
    repo = resp.data;
  } catch (e) {
    console.error(`Repository ${OWNER}/${REPO} not found or no access`);
    process.exit(1);
  }

  const branch = repo.default_branch;
  console.log(`Default branch: ${branch}`);

  // Get latest commit SHA
  const { data: ref } = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${branch}` });
  const latestCommitSha = ref.object.sha;
  console.log(`Latest commit: ${latestCommitSha}`);

  // Get base tree
  const { data: commit } = await octokit.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: latestCommitSha });
  const baseTreeSha = commit.tree.sha;

  // Collect all files
  const files = getAllFiles('/home/runner/workspace');
  console.log(`Found ${files.length} files to push`);

  // Create blobs for all files
  const treeItems = [];
  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const isBinary = file.path.endsWith('.png') || file.path.endsWith('.jpg') || file.path.endsWith('.ico');
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner: OWNER, repo: REPO,
        content: isBinary ? content.toString('base64') : content.toString('utf8'),
        encoding: isBinary ? 'base64' : 'utf-8'
      });
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    } catch (e) {
      console.warn(`Skipping ${file.path}: ${e.message.substring(0, 80)}`);
    }
  }

  console.log(`Created ${treeItems.length} blobs`);

  // Create tree
  const { data: tree } = await octokit.git.createTree({
    owner: OWNER, repo: REPO,
    base_tree: baseTreeSha,
    tree: treeItems
  });
  console.log(`Created tree: ${tree.sha}`);

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner: OWNER, repo: REPO,
    message: 'AgentMinter v2: transferFrom to dead address, wallet connect UI, mint flow',
    tree: tree.sha,
    parents: [latestCommitSha]
  });
  console.log(`Created commit: ${newCommit.sha}`);

  // Update reference
  await octokit.git.updateRef({
    owner: OWNER, repo: REPO,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });
  console.log(`Pushed to ${OWNER}/${REPO} branch ${branch} successfully!`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
