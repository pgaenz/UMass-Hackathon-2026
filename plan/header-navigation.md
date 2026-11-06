# Header and left navigation plan

**Status:** Plan only. Do not implement without a separate request.

## Goal

Make the header fit on one line for every user by moving primary navigation into a persistent left column and keeping only brand, text-size, and account controls in the header.

**Out of scope:** mobile and narrow-screen navigation. The mobile version does not exist yet; this plan covers the current desktop layout only.

## Current problem

At desktop widths the signed-in header wraps to two rows (134px at 1280px, 234px at A++), and at 1024px it reaches three rows (295px at A++). The brand, six navigation links, and the utility group total more than the `max-w-7xl` container. Because the container grows with `rem`, the header never fits on one line even on very wide screens.

## Target layout

```text
┌─────────────────────────────────────────────────────────────┐
│ HistorAI                         A  A+  A++   Profile  Exit │  header
├───────────────┬─────────────────────────────────────────────┤
│ Home          │                                             │
│ Answer a q…   │  Page content                               │
│ Browse q…     │                                             │
│ Read stories  │                                             │
│ Podcasts      │                                             │
│ Messages (3)  │                                             │
│               │                                             │
│ Search        │                                             │
│ Help          │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

- Header: brand left; text-size, profile, and sign-in/out right. No primary nav.
- Left rail: role-specific primary links first, then Search and Help as secondary links.
- Remove **Quick links** from the header. It duplicates the rail and its dropdown/emoji treatment is header-specific.
- Main content remains centered inside the remaining width.
- Footer moves inside the content column so it does not run under the sticky rail.

## Per-user navigation

| User | Header right side | Left rail |
|---|---|---|
| **River** | Text size, profile, sign out | Home, Answer a question (`/senior`), Browse questions, Read stories, Podcasts, Messages (unread badge), Search, Help |
| **Drop** | Text size, profile, sign out | Home, Ask a question (`/questions`), Read stories, Podcasts, Messages (unread badge), Search, Help |
| **Visitor** | Text size, Sign in | Home, Browse questions, Read stories, Podcasts, Search, Help |
| **Signed out on public pages** | Text size, Sign in | Same as Visitor |
| **Signed out on `/login`, `/onboarding`** | Text size, Help | No primary rail; keep these screens focused on role choice |

Notes:

- Drop browsing stays on `/questions`; do not add a second “Browse questions” rail item that points to the same page.
- Visitors and signed-out users never see Messages or Profile.
- Active item uses `aria-current="page"`, a background, and a left accent bar — not color alone.
- Rail rows use visible text labels and at least 44px height.

## Implementation notes

- **Shell:** update `app/layout.tsx` to render the header, then a desktop grid: left rail plus content column. Keep `#main`, the skip link, backdrop, cursor, and tutorial provider in the existing order.
- **Header:** split `components/site-header.tsx` into a compact header and a reusable `SiteNav`. Keep the nav markup in one place.
- **Sticky geometry:** define one shared `--header-height` in `rem`; give the header that height and start the sticky rail below it (`top`, `height`, and `overflow-y-auto`). Do not measure the header with JavaScript.
- **Width:** use a rail around `15rem` wide so A++ labels still fit.
- **No wrapping:** header uses `flex-nowrap`; verify at 1024, 1280, 1440, 1920, and 2560 with A/A+/A++.
- **Auth screens:** keep `hideQuickLinks` behavior by rendering only brand, text-size, and Help for `/login` and `/onboarding`.
- **Quick links:** remove the `QuickLinks` usage from the header; leave the component only if another page still uses it.
- **Tour:** update `lib/tutorial-steps.ts`:
  - `NAV_STEP` targets the visible rail nav.
  - `SEARCH_STEP` and `HELP_STEP` target the rail links.
  - Confirm the tutorial overlay highlights a compact nav block, not the full-height rail.
- **Content width:** recheck pages with `lg:grid-cols-2` (review/actions). If they become cramped at 1280 with the rail, move the two-column breakpoint to a wider size.
- **Icons:** replace emoji header/rail icons with text labels or SVGs; emoji rendering is inconsistent.

## Acceptance criteria

- Signed-in River and Drop headers are one row at every desktop width tested, including A++.
- Every user type sees only the links allowed for their role.
- All previously available destinations remain reachable: questions, stories, podcasts, messages, search, help, profile, sign out, sign in.
- The active route is visible and programmatically marked.
- Keyboard order is brand → rail nav → main → footer; skip link still reaches `#main`.
- The tour highlights the correct rail links and Help/Search steps.
- Footer, content, and sticky rail do not overlap or create horizontal scrolling.
- `npm run build` passes and the relevant home/review flows are manually checked for River, Drop, visitor, and signed-out users.

## Changed paths expected

- `app/layout.tsx`
- `components/site-header.tsx` (or new `components/site-nav.tsx`)
- `components/quick-links.tsx` (usage removal/refactor)
- `lib/tutorial-steps.ts`
- Possibly page grid breakpoints in `app/senior/review/[id]/page.tsx` and `components/review-actions.tsx`
