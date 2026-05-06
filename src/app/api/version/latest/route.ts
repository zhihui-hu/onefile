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

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseVersionYear(yearText: string) {
  if (!/^\d{2}(\d{2})?$/.test(yearText)) return null;

  const year = Number(yearText);
  if (!Number.isInteger(year)) return null;

  return yearText.length === 2 ? 2000 + year : year;
}

function parseVersionMonthDay(year: number, monthDayText: string) {
  if (!/^\d{2,4}$/.test(monthDayText)) return null;

  for (const monthLength of [2, 1]) {
    if (monthDayText.length <= monthLength) continue;

    const month = Number(monthDayText.slice(0, monthLength));
    const day = Number(monthDayText.slice(monthLength));

    if (
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= daysInMonth(year, month)
    ) {
      return { day, month };
    }
  }

  return null;
}

function parseVersionTime(timeText: string) {
  if (!/^\d{1,4}$/.test(timeText)) return null;

  const normalized = timeText.padStart(4, '0');
  const hour = Number(normalized.slice(0, 2));
  const minute = Number(normalized.slice(2));

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

function dateVersionTimestamp(version: string) {
  const [yearText, monthDayText, timeText] = version
    .trim()
    .replace(/^v/i, '')
    .split('.');

  if (!yearText || !monthDayText || !timeText) return null;

  const year = parseVersionYear(yearText);
  if (!year) return null;

  const monthDay = parseVersionMonthDay(year, monthDayText);
  const time = parseVersionTime(timeText);
  if (!monthDay || !time) return null;

  return Date.UTC(
    year,
    monthDay.month - 1,
    monthDay.day,
    time.hour,
    time.minute,
  );
}

function compareNumericVersions(leftVersion: string, rightVersion: string) {
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

function compareVersions(leftVersion: string, rightVersion: string) {
  const leftTimestamp = dateVersionTimestamp(leftVersion);
  const rightTimestamp = dateVersionTimestamp(rightVersion);

  if (leftTimestamp !== null && rightTimestamp !== null) {
    if (leftTimestamp > rightTimestamp) return 1;
    if (leftTimestamp < rightTimestamp) return -1;
    return 0;
  }

  return compareNumericVersions(leftVersion, rightVersion);
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
  return compareVersions(latestVersion, currentVersion) > 0;
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
  return withApiHandler(async () => {
    const { owner, repo } = githubRepoPath();

    return ok(await fetchLatestTagVersion(owner, repo), {
      headers: cacheHeaders(),
    });
  });
}
