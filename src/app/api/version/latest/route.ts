import { siteConfig } from '@/config/site';
import { ok, withApiHandler } from '@/lib/api/response';

export const runtime = 'nodejs';

const GITHUB_API_VERSION = '2022-11-28';
const VERSION_CHECK_REVALIDATE_SECONDS = 60 * 60;

type GitHubTag = {
  commit?: {
    sha?: unknown;
    url?: unknown;
  };
  name?: unknown;
  tarball_url?: unknown;
  zipball_url?: unknown;
};

class GitHubFetchError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function githubRepoPath() {
  const url = new URL(siteConfig.githubUrl);
  const [owner, repo] = url.pathname.replace(/^\/|\/$/g, '').split('/');

  if (!owner || !repo) {
    throw new Error('GitHub repository URL is not configured correctly');
  }

  return { owner, repo: repo.replace(/\.git$/i, '') };
}

function versionLabel(version: string) {
  return version.trim().match(/^v/i) ? version.trim() : `v${version.trim()}`;
}

function numericVersionParts(version: string) {
  return version
    .trim()
    .replace(/^v/i, '')
    .match(/\d+/g)
    ?.map(Number)
    .filter(Number.isFinite);
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
  const latestParts = numericVersionParts(latestVersion);
  const currentParts = numericVersionParts(currentVersion);

  if (!latestParts?.length || !currentParts?.length) {
    return latestVersion.trim() !== currentVersion.trim();
  }

  const length = Math.max(latestParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const latest = latestParts[index] ?? 0;
    const current = currentParts[index] ?? 0;
    if (latest > current) return true;
    if (latest < current) return false;
  }

  return false;
}

function compareVersions(leftVersion: string, rightVersion: string) {
  const leftParts = numericVersionParts(leftVersion);
  const rightParts = numericVersionParts(rightVersion);

  if (!leftParts?.length || !rightParts?.length) {
    return leftVersion.localeCompare(rightVersion);
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = leftParts[index] ?? 0;
    const right = rightParts[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

async function fetchGitHubJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OneFile-Version-Check',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    next: { revalidate: VERSION_CHECK_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new GitHubFetchError(response.status, response.statusText);
  }

  return (await response.json()) as T;
}

function versionResult({
  latestVersion,
  publishedAt,
  url,
}: {
  latestVersion: string;
  publishedAt?: string | null;
  url: string;
}) {
  const currentVersion = siteConfig.version;

  return {
    checkedAt: new Date().toISOString(),
    currentVersion,
    latestVersion,
    latestVersionLabel: versionLabel(latestVersion),
    publishedAt: publishedAt ?? null,
    source: 'tag',
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    url,
  };
}

async function fetchLatestTagVersion(owner: string, repo: string) {
  const tags = await fetchGitHubJson<GitHubTag[]>(
    `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`,
  );

  const latestTag = tags
    .filter((tag): tag is GitHubTag & { name: string } => {
      return typeof tag.name === 'string' && tag.name.trim().length > 0;
    })
    .sort((left, right) => compareVersions(right.name, left.name))[0];

  if (!latestTag) {
    throw new Error('GitHub repository does not contain any tags');
  }

  return versionResult({
    latestVersion: latestTag.name,
    url: `${siteConfig.githubUrl}/releases/tag/${encodeURIComponent(
      latestTag.name,
    )}`,
  });
}

function cacheHeaders() {
  return {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  };
}

export async function GET() {
  return withApiHandler(
    async () => {
      const { owner, repo } = githubRepoPath();

      return ok(await fetchLatestTagVersion(owner, repo), {
        headers: cacheHeaders(),
      });
    },
    { label: 'api/version/latest' },
  );
}
