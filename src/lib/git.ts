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
    const result = execSync(
      `git log -1 --format=%cI -- "${filePath}"`,
      { encoding: "utf-8" },
    ).trim();
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
    const result = execSync(
      `git log --format='%aN|%aE' -- "${filePath}"`,
      { encoding: "utf-8" },
    ).trim();
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

/**
 * Extract GitHub username from a noreply email.
 * Handles both formats:
 *   - `username@users.noreply.github.com`
 *   - `12345+username@users.noreply.github.com`
 */
function extractGitHubUsername(email: string): string | undefined {
  const match = email.match(
    /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i,
  );
  return match?.[1];
}
