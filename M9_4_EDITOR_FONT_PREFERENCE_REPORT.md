# M9.4 — Editor Font Preference Application & Browser Regression

## Existing preference and supported values

- `editorFontFamily` is persisted as a string and defaults to `serif`.

## Where and how the preference is applied

- `main.tsx` sets `--editor-font-family` on `document.documentElement` during authenticated initialization.
- `.tiptap-editor .ProseMirror` uses `font-family: var(--editor-font-family, inherit)`.

## Browser scenarios added

- Sets editor font family to `monospace`, saves, opens a document, verifies computed font family, and verifies persistence after reload.

## Reload persistence and account-isolation results

- Reload persistence verified.
- Account isolation not automated.

## Exact verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (14 browser tests)

## Remaining limitations

- Only theme and font-family preferences are browser-tested.
- Font size/line height application is not yet verified in browser tests.
