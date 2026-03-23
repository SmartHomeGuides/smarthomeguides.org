import { getCollection, type CollectionEntry } from "astro:content";
import { languages } from "@i18n/index";
import type { Locale } from "@i18n/index";

export type Category =
  | "fundamentals"
  | "intermediate"
  | "advanced"
  | "glossary";

export const categories: Category[] = [
  "fundamentals",
  "intermediate",
  "advanced",
  "glossary",
];

const localeKeys = Object.keys(languages);

// ---------------------------------------------------------------------------
// Entry ID parsing
// ---------------------------------------------------------------------------

interface ParsedEntryId {
  category: Category;
  guideSlug: string;
  chapterSlug: string | null;
  locale: Locale;
}

/**
 * Strip the locale suffix from the last segment of an entry ID.
 * e.g. `what-is-home-automationen` → `what-is-home-automation`
 */
function stripLocaleSuffix(segment: string): { name: string; locale: Locale } {
  const suffix = segment.slice(-2);
  if (localeKeys.includes(suffix)) {
    return { name: segment.slice(0, -2), locale: suffix as Locale };
  }
  return { name: segment, locale: "en" };
}

/**
 * Parse a content collection entry ID into its components.
 *
 * Single-page:  `fundamentals/what-is-home-automationen`
 *   → { category: "fundamentals", guideSlug: "what-is-home-automation", chapterSlug: null, locale: "en" }
 *
 * Multi-page:   `fundamentals/what-is-home-automation/01-introductionen`
 *   → { category: "fundamentals", guideSlug: "what-is-home-automation", chapterSlug: "01-introduction", locale: "en" }
 */
export function parseEntryId(entryId: string): ParsedEntryId {
  const parts = entryId.split("/");

  if (parts.length >= 3) {
    // Multi-page: category / guideSlug / chapterWithLocale
    const category = parts[0] as Category;
    const guideSlug = parts[1];
    const { name: chapterSlug, locale } = stripLocaleSuffix(parts[2]);
    return { category, guideSlug, chapterSlug, locale };
  }

  // Single-page: category / slugWithLocale
  const category = parts[0] as Category;
  const { name: guideSlug, locale } = stripLocaleSuffix(parts[1] ?? "");
  return { category, guideSlug, chapterSlug: null, locale };
}

// ---------------------------------------------------------------------------
// Basic accessors (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function getGuideLocale(entryId: string): Locale {
  return parseEntryId(entryId).locale;
}

export function getGuideCategory(entryId: string): Category {
  return parseEntryId(entryId).category;
}

/**
 * Returns the full URL slug for an entry.
 * Single-page: `what-is-home-automation`
 * Multi-page:  `what-is-home-automation/01-introduction`
 */
export function getGuideSlug(entryId: string): string {
  const { guideSlug, chapterSlug } = parseEntryId(entryId);
  return chapterSlug ? `${guideSlug}/${chapterSlug}` : guideSlug;
}

/**
 * Returns just the guide folder name (ignoring chapter).
 * Always returns `what-is-home-automation` regardless of whether it's a chapter or single-page.
 */
export function getGuideParentSlug(entryId: string): string {
  return parseEntryId(entryId).guideSlug;
}

/**
 * Returns true if the entry represents a category index file.
 */
export function isIndexEntry(entryId: string): boolean {
  const { guideSlug, chapterSlug } = parseEntryId(entryId);
  // Index at category level: `fundamentals/indexen`
  if (chapterSlug === null && guideSlug === "index") return true;
  // Index inside a guide folder: `fundamentals/guide-name/indexen`
  if (chapterSlug === "index") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Multi-page guide grouping
// ---------------------------------------------------------------------------

export interface GuideGroup {
  guideSlug: string;
  guideTitle: string;
  isMultiPage: boolean;
  entries: CollectionEntry<"docs">[]; // sorted chapters, or single entry
}

/**
 * Extract the numeric prefix from a chapter slug for sorting.
 * `01-introduction` → 1, `02-protocols` → 2, `no-prefix` → Infinity
 */
export function getChapterOrder(chapterSlug: string): number {
  const match = chapterSlug.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

/**
 * Group entries for a category/locale into GuideGroups.
 * Multi-page guides have their chapters sorted by numeric prefix.
 */
export async function getGroupedGuides(
  locale: Locale,
  category: Category,
): Promise<GuideGroup[]> {
  const entries = await getGuidesByCategory(locale, category);
  const groupMap = new Map<string, CollectionEntry<"docs">[]>();

  for (const entry of entries) {
    const parentSlug = getGuideParentSlug(entry.id);
    const group = groupMap.get(parentSlug);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(parentSlug, [entry]);
    }
  }

  const groups: GuideGroup[] = [];
  for (const [guideSlug, groupEntries] of groupMap) {
    const isMultiPage = groupEntries.some(
      (e) => parseEntryId(e.id).chapterSlug !== null,
    );

    // Sort chapters by numeric prefix
    if (isMultiPage) {
      groupEntries.sort((a, b) => {
        const aChapter = parseEntryId(a.id).chapterSlug ?? "";
        const bChapter = parseEntryId(b.id).chapterSlug ?? "";
        return getChapterOrder(aChapter) - getChapterOrder(bChapter);
      });
    }

    const firstEntry = groupEntries[0];
    const guideTitle = isMultiPage
      ? (firstEntry.data.guideTitle ?? firstEntry.data.title)
      : firstEntry.data.title;

    groups.push({ guideSlug, guideTitle, isMultiPage, entries: groupEntries });
  }

  return groups;
}

/**
 * Flatten guide groups into a single ordered list for prev/next navigation.
 */
export function buildLinearOrder(
  groups: GuideGroup[],
): CollectionEntry<"docs">[] {
  return groups.flatMap((g) => g.entries);
}

/**
 * Build the URL for any guide entry.
 */
export function getGuideEntryUrl(
  base: string,
  locale: Locale,
  category: Category,
  entry: CollectionEntry<"docs">,
): string {
  return `${base}${locale}/guides/${category}/${getGuideSlug(entry.id)}`;
}

// ---------------------------------------------------------------------------
// Collection queries
// ---------------------------------------------------------------------------

export async function getIndexEntry(locale: Locale, category: Category) {
  const all = await getCollection("docs", (entry) => {
    return (
      !entry.data.draft &&
      getGuideLocale(entry.id) === locale &&
      entry.data.category === category &&
      isIndexEntry(entry.id)
    );
  });
  return all[0];
}

export async function getGuidesByCategory(locale: Locale, category: Category) {
  return getCollection("docs", (entry) => {
    return (
      !entry.data.draft &&
      getGuideLocale(entry.id) === locale &&
      entry.data.category === category &&
      !isIndexEntry(entry.id)
    );
  });
}

export async function getAllGuidesForLocale(locale: Locale) {
  return getCollection("docs", (entry) => {
    return !entry.data.draft && getGuideLocale(entry.id) === locale;
  });
}

/**
 * Returns BASE_URL with a guaranteed trailing slash.
 */
export function getBase(): string {
  const raw = import.meta.env.BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}
