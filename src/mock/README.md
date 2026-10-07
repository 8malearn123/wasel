# Mock data — not production data

Everything in this folder is **placeholder data for developing the UI**. None of
it is real, none of it comes from the database, and none of it should ever be
shown to a merchant as if it were theirs.

It exists because the backend for these features has not been built yet. Each
mock implements a contract in `src/services/contracts/`, and
`src/services/index.ts` chooses between mock and real in one place.

## How to tell at a glance

- Every mock service lives here, never in `src/hooks` or `src/pages`.
- Every record has an `id` prefixed `mock-`.
- When mocks are active the app shows a **"بيانات تجريبية"** banner on every
  screen that uses one, so nobody mistakes it for live data.

## Replacing a mock

In `src/services/index.ts`, swap the mock for an implementation of the same
interface. No page or component changes.

Numbers that are commercial decisions — shipping prices, modification fees,
marketing rates, lateness rules — are **deliberately absent or null** in these
mocks. The UI renders "غير محدد" for them. Do not fill them in here; they belong
to the backend once the business defines them.
