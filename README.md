# SmartHomeGuides.org

Open-source, community-driven guides for home automation enthusiasts at every level.

## Vision

SmartHomeGuides is a free knowledge base where beginners learn the basics, intermediates deepen their skills, and advanced users push the boundaries of what's possible with smart homes. All content is open source and community-maintained.

We champion the core values of the [Open Home Foundation](https://www.openhomefoundation.org/): **privacy**, **choice**, and **sustainability**.

## Content

Guides are organized into four pillars:

| Category         | Audience                | Examples                                                            |
| :--------------- | :---------------------- | :------------------------------------------------------------------ |
| **Fundamentals** | Complete beginners      | What is home automation, protocols explained, choosing a hub        |
| **Intermediate** | Users with a setup      | MQTT, energy dashboards, Node-RED, voice assistants                 |
| **Advanced**     | Power users & devs      | Custom ESPHome firmware, DIY sensors, local AI, security hardening  |
| **Glossary**     | Everyone                | Searchable reference of terms, protocols, and acronyms              |

All content lives as `.mdx` files in `src/content/docs/`, versioned with Git, reviewable via pull requests.

## Tech Stack

| Layer              | Technology                  |
| :----------------- | :-------------------------- |
| Framework          | Astro v6                    |
| Language           | TypeScript (strictest)      |
| Styling            | Tailwind CSS v4 + DaisyUI 5 |
| Content            | MDX                         |
| Search             | Pagefind                    |
| Comments & voting  | Giscus (GitHub Discussions) |
| i18n               | English + French            |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/about/previous-releases#release-schedule) lts/krypton (v24) (use [nvm](https://github.com/nvm-sh/nvm) — the `.nvmrc` is included)
- [pnpm](https://pnpm.io/) v10+

### Setup

```sh
nvm use
pnpm install
```

### Development

```sh
pnpm dev          # Start dev server at localhost:4321
pnpm build        # Production build to ./dist/
pnpm preview      # Preview the production build locally
```

### Code Quality

```sh
pnpm lint         # Run ESLint
pnpm lint:fix     # Run ESLint with auto-fix
pnpm format       # Format all files with Prettier
pnpm format:check # Check formatting without writing
```

A pre-commit hook (via Husky + lint-staged) automatically runs ESLint and Prettier on staged files.

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── content/
│   └── docs/            # MDX guide files
├── i18n/                # Translation files (en.json, fr.json) and helpers
├── layouts/             # Page layouts
├── pages/               # Astro file-based routing
│   └── [locale]/        # Locale-prefixed routes (/en/..., /fr/...)
└── styles/              # Global CSS (Tailwind + DaisyUI)
```

Guide files use a co-located i18n pattern with locale suffixes:

```
src/content/docs/fundamentals/
├── what-is-home-automation.en.mdx
└── what-is-home-automation.fr.mdx
```

## Contributing

We welcome contributions of all kinds — new guides, translations, typo fixes, code improvements.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the content template, style guide, i18n process, and PR workflow.

Every merged contributor is automatically credited on the guide page and on the Contributors page.

## License

- **Code** (Astro components, configs, tooling): [MIT](LICENSE)
- **Content** (guides, diagrams, images): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
