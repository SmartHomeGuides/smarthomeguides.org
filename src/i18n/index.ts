import en from "./en.json";
import fr from "./fr.json";

export const languages = {
  en: "English",
  fr: "Français",
} as const;

export type Locale = keyof typeof languages;

export const defaultLocale: Locale = "en";

const translations = { en, fr } as const;

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<typeof en>;

/**
 * Get a translated string by dot-notation key.
 * Supports simple placeholder replacement: `{minutes}` in the string
 * will be replaced by `params.minutes`.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations[locale];

  for (const k of keys) {
    value = value?.[k];
  }

  if (typeof value !== "string") {
    // Fallback to default locale
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: any = translations[defaultLocale];
    for (const k of keys) {
      fallback = fallback?.[k];
    }
    value = typeof fallback === "string" ? fallback : key;
  }

  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      value = value.replace(`{${param}}`, String(replacement));
    }
  }

  return value;
}

/**
 * Extract locale from a file path like `what-is-home-automation.fr.mdx`
 */
export function getLocaleFromSlug(slug: string): Locale {
  const match = slug.match(/\.([a-z]{2})$/);
  if (match && match[1] in languages) {
    return match[1] as Locale;
  }
  return defaultLocale;
}

/**
 * Remove the locale suffix from a slug: `what-is-home-automation.fr` -> `what-is-home-automation`
 */
export function removeLocaleFromSlug(slug: string): string {
  return slug.replace(/\.[a-z]{2}$/, "");
}
