# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Product decisions

- The selected direction is the first Content Workbench concept: a three-column desktop content-library view with a deep-green navigation rail and a right-side detail panel.
- The selected RedFox expansion direction is the third revised Topic Radar concept: a master-detail research view with a compact ranked topic list on the left and the selected topic's trends, cross-platform samples, audience fit, reusable patterns, and actions on the right.
- Topic Radar must be grounded in a saved industry profile rather than showing an undifferentiated global hot list by default. Results are grouped as direct industry opportunities, adjacent-industry transferable ideas, and cross-industry structural references. Every transferred topic must explain its industry relevance and provide a localized angle before it can be saved or collected.
- The product is an independent sidecar application. It may call the existing MediaCrawler APIs, but must not modify MediaCrawler source code, existing WebUI behavior, collection logic, or original source links.
- Inspira is an optional independent inspiration and operations service, not code to merge into MediaCrawler. Run it on port 8181 with its own data directory and access it through a workbench adapter. Prefer the unmodified upstream process because Inspira is AGPL-3.0; any modified network deployment needs a separate license review.
- Exclude WeChat Official Accounts from the product: no official-account hot lists, AI official-account feeds, short-drama official-account feeds, WeRss, MP Stats, official-account tracking, or official-account rewrite targets. WeChat Channels remains in scope.
- Topic generation must use an active industry profile and preserve evidence links. Results are grouped into direct industry opportunities, adjacent-industry transferable ideas, and cross-industry structural references; low-evidence ideas must be labeled.
- The former generic “任务” label is “采集任务”. A completed collection task must be deliberately synchronized into the content library before its results appear there.
- The content library must preserve and expose historical collection keywords as selectable tags. The active keyword filters the list below it.
- Platform, synchronization state, and processing state are separate fields. Never use “已同步” as a fallback platform label.
- Platform selection is a dedicated dropdown filter and composes with keyword, search, and processing-state filters.
- Synced content is deduplicated by platform plus source content identity. Downloaded cover images open in a full-image viewer, while downloaded video and audio remain playable in the item workbench.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
