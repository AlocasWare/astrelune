# M7.4 — Writing Activity & Preferences Integration

## Editor-to-activity integration

- Successful document saves already record writing activity within the save transaction.
- Activity includes user, project, document, idempotency key, date, and words added.
- Failed or conflicted saves do not record activity.
- Activity failures are contained within the save transaction's existing error handling.

## Idempotency and duplicate prevention

- Activity idempotency uses `userId + documentId + idempotencyKey`.
- Replayed saves with the same request key return the existing activity.

## Goal progress behavior

- Goal progress aggregates activity within the current daily or weekly period.
- UTC date boundaries are used consistently.
- Empty activity and expired goals are handled.

## Preferences implemented and applied

- Backend supports theme, editor font family, font size, line height, and focus mode default.
- SettingsScreen loads and saves preferences.
- Application startup loads preferences and applies theme and editor CSS variables.

## Theme behavior

- Theme is applied to `document.documentElement.dataset.theme`.
- Additional CSS consumption of theme variables can be expanded later.

## Tests added

- Existing API and integration tests remain passing.
- No new tests were added in this slice beyond prior coverage.

## Remaining limitations

- Activity recording remains tied to document saves, not all editor interactions.
- Preference application is limited to root-level CSS variables.
- No browser automation covers settings persistence yet.
  EOF
