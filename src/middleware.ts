import { sequence } from "astro:middleware";
import { middleware as i18nMiddleware } from "astro:i18n";

export const onRequest = sequence(
  i18nMiddleware({
    redirectToDefaultLocale: false,
    prefixDefaultLocale: false,
  }),
);
