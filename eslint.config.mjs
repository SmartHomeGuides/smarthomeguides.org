import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  ...tseslint.configs.strict,
  ...eslintPluginAstro.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["dist/", ".astro/", "node_modules/"],
  },
);
