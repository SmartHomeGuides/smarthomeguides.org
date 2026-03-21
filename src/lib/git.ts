import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

export interface Contributor {
  name: string;
  avatarUrl: string;
  profileUrl?: string;
}

/**
 * Get the last modified date of a file from git history.
 * Returns undefined if the file has no git history (e.g. uncommitted new file).
 */
export function getLastModified(filePath: string): Date | undefined {
  try {
    const result = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
      encoding: "utf-8",
    }).trim();
    return result ? new Date(result) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get unique contributors for a file from git history.
 * Extracts GitHub usernames from noreply emails when possible,
 * otherwise falls back to gravatar URLs.
 */
export function getContributors(filePath: string): Contributor[] {
  try {
    const result = execSync(`git log --format='%aN|%aE' -- "${filePath}"`, {
      encoding: "utf-8",
    }).trim();
    if (!result) return [];

    const seen = new Set<string>();
    const contributors: Contributor[] = [];

    for (const line of result.split("\n")) {
      const [name, email] = line.split("|");
      if (!name || !email) continue;

      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const github = extractGitHubUsername(email);
      if (github) {
        contributors.push({
          name,
          avatarUrl: `https://github.com/${github}.png?size=64`,
          profileUrl: `https://github.com/${github}`,
        });
      } else {
        const hash = createHash("md5")
          .update(email.trim().toLowerCase())
          .digest("hex");
        contributors.push({
          name,
          avatarUrl: `https://www.gravatar.com/avatar/${hash}?s=64&d=identicon`,
        });
      }
    }

    return contributors;
  } catch {
    return [];
  }
}

export type ContributorRank =
  | "newcomer"
  | "contributor"
  | "advocate"
  | "champion";

export interface ContributorProfile {
  name: string;
  avatarUrl: string;
  profileUrl?: string;
  mergedPRs: number;
  commitCount: number;
  guides: { title: string; href: string }[];
  rank: ContributorRank;
}

interface GuideInfo {
  filePath: string;
  title: string;
  href: string;
}

const RANK_THRESHOLDS: { min: number; rank: ContributorRank }[] = [
  { min: 20, rank: "champion" },
  { min: 10, rank: "advocate" },
  { min: 3, rank: "contributor" },
  { min: 0, rank: "newcomer" },
];

function assignRank(count: number): ContributorRank {
  const match = RANK_THRESHOLDS.find((t) => count >= t.min);
  return match ? match.rank : "newcomer";
}

const REPO = "smarthomeguides/smarthomeguides.org";

/**
 * Fetch merged PR counts per GitHub username from the GitHub API.
 * Returns a Map of GitHub login → merged PR count.
 * Falls back to an empty map if GITHUB_TOKEN is not set or the request fails.
 */
async function fetchMergedPRCounts(): Promise<Map<string, number>> {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) return new Map();

  const counts = new Map<string, number>();

  try {
    let page = 1;
    while (true) {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (!res.ok) break;

      const pulls = (await res.json()) as {
        merged_at: string | null;
        user: { login: string } | null;
      }[];
      if (pulls.length === 0) break;

      for (const pr of pulls) {
        if (pr.merged_at && pr.user) {
          const login = pr.user.login.toLowerCase();
          counts.set(login, (counts.get(login) ?? 0) + 1);
        }
      }

      page++;
    }
  } catch {
    // Silently fall back to empty counts
  }

  return counts;
}

/**
 * Build aggregated contributor profiles across all guides.
 * Combines git history (commit counts + guide mapping) with GitHub API (merged PR counts).
 */
export async function getAllContributorProfiles(
  guides: GuideInfo[],
): Promise<ContributorProfile[]> {
  const contributorMap = new Map<
    string,
    {
      name: string;
      email: string;
      githubUsername?: string;
      guideHrefs: Set<string>;
    }
  >();

  // Map guide href → title for later lookup
  const guideTitleMap = new Map<string, string>();
  for (const g of guides) {
    guideTitleMap.set(g.href, g.title);
  }

  // Build contributor → guides mapping from per-file git log
  for (const guide of guides) {
    if (!guide.filePath) continue;

    try {
      const result = execSync(
        `git log --format='%aN|%aE' -- "${guide.filePath}"`,
        { encoding: "utf-8" },
      ).trim();
      if (!result) continue;

      const seen = new Set<string>();
      for (const line of result.split("\n")) {
        const [name, email] = line.split("|");
        if (!name || !email) continue;

        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        let entry = contributorMap.get(key);
        if (!entry) {
          entry = {
            name,
            email: key,
            githubUsername: extractGitHubUsername(email),
            guideHrefs: new Set(),
          };
          contributorMap.set(key, entry);
        }
        entry.guideHrefs.add(guide.href);
      }
    } catch {
      // Skip files with no git history
    }
  }

  // Get commit counts via git shortlog
  const commitCounts = new Map<string, number>();
  try {
    const shortlog = execSync(`git shortlog -sne -- "src/content/docs"`, {
      encoding: "utf-8",
    }).trim();
    for (const line of shortlog.split("\n")) {
      const match = line.match(/^\s*(\d+)\s+.+<(.+)>$/);
      if (match) {
        commitCounts.set(match[2].toLowerCase(), parseInt(match[1], 10));
      }
    }
  } catch {
    // Fall back to 0 counts
  }

  // Fetch merged PR counts from GitHub API
  const prCounts = await fetchMergedPRCounts();

  // Build final profiles
  const profiles: ContributorProfile[] = [];

  for (const [emailKey, entry] of contributorMap) {
    const github = entry.githubUsername;
    const commits = commitCounts.get(emailKey) ?? 0;
    const mergedPRs = github
      ? (prCounts.get(github.toLowerCase()) ?? commits)
      : commits;

    let avatarUrl: string;
    let profileUrl: string | undefined;

    if (github) {
      avatarUrl = `https://github.com/${github}.png?size=128`;
      profileUrl = `https://github.com/${github}`;
    } else {
      const hash = createHash("md5").update(emailKey).digest("hex");
      avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=128&d=identicon`;
    }

    const guideLinks = Array.from(entry.guideHrefs).map((href) => ({
      title: guideTitleMap.get(href) ?? href,
      href,
    }));

    profiles.push({
      name: entry.name,
      avatarUrl,
      profileUrl,
      mergedPRs,
      commitCount: commits,
      guides: guideLinks,
      rank: assignRank(mergedPRs),
    });
  }

  // Sort by merged PRs descending, then name ascending
  profiles.sort(
    (a, b) => b.mergedPRs - a.mergedPRs || a.name.localeCompare(b.name),
  );

  return profiles;
}

/**
 * Extract GitHub username from a noreply email.
 * Handles both formats:
 *   - `username@users.noreply.github.com`
 *   - `12345+username@users.noreply.github.com`
 */
export function extractGitHubUsername(email: string): string | undefined {
  const match = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  return match?.[1];
}
