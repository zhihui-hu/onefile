import { siteConfig } from '@/config/site';
import { ok, withApiHandler } from '@/lib/api/response';

export const runtime = 'nodejs';

const GITHUB_API_VERSION = '2022-11-28';
const VERSION_CHECK_REVALIDATE_SECONDS = 60 * 60;

type GitHubRelease = {
  html_url?: unknown;
  published_at?: unknown;
  tag_name?: unknown;
};

type GitHubRepo = {
  default_branch?: unknown;
  html_url?: unknown;
};

type RemotePackage = {
  version?: unknown;
};

type LatestVersionSource = 'release' | 'package';

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

async function fetchRawJson<T>(url: string) {
  const response = await fetch(url, {
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
  source,
  url,
}: {
  latestVersion: string;
  publishedAt?: string | null;
  source: LatestVersionSource;
  url: string;
}) {
  const currentVersion = siteConfig.version;

  return {
    checkedAt: new Date().toISOString(),
    currentVersion,
    latestVersion,
    latestVersionLabel: versionLabel(latestVersion),
    publishedAt: publishedAt ?? null,
    source,
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    url,
  };
}

async function fetchLatestPackageVersion(owner: string, repo: string) {
  const repoInfo = await fetchGitHubJson<GitHubRepo>(
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  const branch =
    typeof repoInfo.default_branch === 'string'
      ? repoInfo.default_branch
      : 'main';
  const remotePackage = await fetchRawJson<RemotePackage>(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
  );

  if (typeof remotePackage.version !== 'string') {
    throw new Error('Remote package.json does not contain a version');
  }

  return versionResult({
    latestVersion: remotePackage.version,
    source: 'package',
    url:
      typeof repoInfo.html_url === 'string'
        ? `${repoInfo.html_url}/blob/${branch}/package.json`
        : siteConfig.githubUrl,
  });
}

export async function GET() {
  return withApiHandler(
    async () => {
      const { owner, repo } = githubRepoPath();

      try {
        const release = await fetchGitHubJson<GitHubRelease>(
          `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        );

        if (typeof release.tag_name === 'string') {
          return ok(
            versionResult({
              latestVersion: release.tag_name,
              publishedAt:
                typeof release.published_at === 'string'
                  ? release.published_at
                  : null,
              source: 'release',
              url:
                typeof release.html_url === 'string'
                  ? release.html_url
                  : `${siteConfig.githubUrl}/releases/latest`,
            }),
            {
              headers: {
                'Cache-Control':
                  'public, max-age=300, stale-while-revalidate=3600',
              },
            },
          );
        }
      } catch (error) {
        if (!(error instanceof GitHubFetchError)) {
          throw error;
        }
      }

      return ok(await fetchLatestPackageVersion(owner, repo), {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    },
    { label: 'api/version/latest' },
  );
}
