import type { CollectionEntry } from "astro:content";
import type { Locale } from "@i18n/index";
import type { Category } from "./guides";
import { getGuidesByCategory, getGroupedGuides, getBase } from "./guides";
import fs from "node:fs";
import path from "node:path";

export interface ResolvedGuide {
  title: string;
  description?: string;
  href: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

const NON_GLOSSARY_CATEGORIES: Category[] = [
  "fundamentals",
  "intermediate",
  "advanced",
];

/**
 * Fetch all glossary terms for a locale, sorted alphabetically by title.
 */
export async function getGlossaryTerms(
  locale: Locale,
): Promise<CollectionEntry<"docs">[]> {
  const entries = await getGuidesByCategory(locale, "glossary");
  return entries.sort((a, b) =>
    a.data.title.localeCompare(b.data.title, locale),
  );
}

/**
 * Strip diacritics from a string so accented characters map to their base letter.
 * e.g. "Eclairage" → "Eclairage", "Eclairage" → "Eclairage"
 */
function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Group glossary terms by the uppercase first letter of their title.
 */
export function groupTermsByLetter(
  terms: CollectionEntry<"docs">[],
): Map<string, CollectionEntry<"docs">[]> {
  const groups = new Map<string, CollectionEntry<"docs">[]>();

  for (const term of terms) {
    const firstChar = stripDiacritics(term.data.title).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : "#";
    const group = groups.get(letter);
    if (group) {
      group.push(term);
    } else {
      groups.set(letter, [term]);
    }
  }

  // Sort by letter
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Auto-detect which guides mention the given term title in their content.
 * Scans all non-glossary guide entries and returns one result per guide
 * (not per chapter).
 */
export async function findRelatedGuides(
  termTitle: string,
  locale: Locale,
): Promise<ResolvedGuide[]> {
  const base = getBase();
  const regex = new RegExp(`\\b${escapeRegExp(termTitle)}\\b`, "i");
  const resolved: ResolvedGuide[] = [];

  for (const category of NON_GLOSSARY_CATEGORIES) {
    const groups = await getGroupedGuides(locale, category);
    for (const group of groups) {
      let found = false;
      for (const entry of group.entries) {
        try {
          const content = fs.readFileSync(
            path.resolve(entry.filePath ?? ""),
            "utf-8",
          );
          if (regex.test(content)) {
            found = true;
            break;
          }
        } catch {
          continue;
        }
      }
      if (found) {
        resolved.push({
          title: group.guideTitle,
          description: group.guideDescription,
          href: `${base}${locale}/guides/${category}/${group.guideSlug}`,
          difficulty: group.difficulty,
        });
      }
    }
  }

  return resolved;
}
