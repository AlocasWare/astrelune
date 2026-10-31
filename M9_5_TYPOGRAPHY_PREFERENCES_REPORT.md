# M9.5 — Editor Typography Preferences & Browser Regression

## Typography preferences that exist

- `editorFontSize` (default 18).
- `editorLineHeight` (default 1.7).

## Persisted and exposed

- Both are persisted and exposed in the Settings UI.

## Applied to the editor

- Both are applied through CSS variables and `.tiptap-editor .ProseMirror` styling.

## Browser tests added

- Verifies font size and line height application and persistence after reload.

## Persistence and compatibility results

- Reload persistence verified.
- Existing theme and font-family behavior remains intact.

## Unsupported preferences

- None identified; all supported typography preferences are applied.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (15 browser tests)
  EOF
