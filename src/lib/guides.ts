import { getCollection } from "astro:content";
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

/**
 * Extract locale from a content collection entry ID.
 * The glob loader strips dots, so IDs look like:
 *   `fundamentals/what-is-home-automationen`
 * We check the last 2 characters against known locales.
 */
export function getGuideLocale(entryId: string): Locale {
  const suffix = entryId.slice(-2);
  if (localeKeys.includes(suffix)) {
    return suffix as Locale;
  }
  return "en";
}

/**
 * Extract the category folder from an entry ID.
 * e.g. `fundamentals/what-is-home-automationen` → `fundamentals`
 */
export function getGuideCategory(entryId: string): Category {
  return entryId.split("/")[0] as Category;
}

/**
 * Extract a clean URL slug from an entry ID.
 * e.g. `fundamentals/what-is-home-automationen` → `what-is-home-automation`
 */
export function getGuideSlug(entryId: string): string {
  const filename = entryId.split("/").pop()!;
  const suffix = filename.slice(-2);
  if (localeKeys.includes(suffix)) {
    return filename.slice(0, -2);
  }
  return filename;
}

export async function getGuidesByCategory(
  locale: Locale,
  category: Category,
) {
  return getCollection("docs", (entry) => {
    return (
      !entry.data.draft &&
      getGuideLocale(entry.id) === locale &&
      entry.data.category === category
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
