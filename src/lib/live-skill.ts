export const GITHUB_OWNER = "aeonterminal";
export const GITHUB_REPO = "aeon-terminal";

export type GithubMonitorSnapshot = {
  fullName: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  latestCommit: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  };
  latestRelease: {
    tag: string;
    name: string;
    publishedAt: string;
    url: string;
  } | null;
};

type RepoResponse = {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
};

type CommitResponse = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
};

type ReleaseResponse = {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
};

const BASE = "https://api.github.com";
const HEADERS = {
  accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

/**
 * Fetch the live status of {owner}/{repo} from the public GitHub API:
 * stars, open issues, latest commit, and latest release (if any).
 *
 * Runs from the browser without authentication. The public limit is
 * 60 req/hr per IP which is plenty for a 5-minute polling cycle.
 * Returns `null` on any failure so callers can hide the panel gracefully.
 */
export async function fetchGithubMonitor(
  signal?: AbortSignal,
): Promise<GithubMonitorSnapshot | null> {
  try {
    const [repoRes, commitsRes, releaseRes] = await Promise.all([
      fetch(`${BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
        signal,
        headers: HEADERS,
      }),
      fetch(
        `${BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=1`,
        { signal, headers: HEADERS },
      ),
      fetch(
        `${BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        { signal, headers: HEADERS },
      ),
    ]);

    if (!repoRes.ok || !commitsRes.ok) return null;

    const repo = (await repoRes.json()) as RepoResponse;
    const commits = (await commitsRes.json()) as CommitResponse[];
    if (!Array.isArray(commits) || commits.length === 0) return null;

    const c = commits[0];
    const firstLine = c.commit.message.split("\n")[0];

    let release: GithubMonitorSnapshot["latestRelease"] = null;
    if (releaseRes.ok) {
      const r = (await releaseRes.json()) as ReleaseResponse;
      release = {
        tag: r.tag_name,
        name: r.name ?? r.tag_name,
        publishedAt: r.published_at,
        url: r.html_url,
      };
    }

    return {
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      latestCommit: {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: firstLine,
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
      },
      latestRelease: release,
    };
  } catch {
    return null;
  }
}

/**
 * Format an ISO date as "Xs/m/h/d ago" relative to now.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
