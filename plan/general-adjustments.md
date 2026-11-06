# General adjustments plan: clearer copy, readable text, calmer pointer, steadier header

**Status:** Implemented (recommended options) except item 3.3, which stays unchanged pending the product owner. Items marked **Decision** were resolved with the recommended option; the list is recorded under *Decisions taken* below.

> **Decisions taken** (per §11.1):
> 1. Age label (3.3): **unchanged** — awaiting product owner.
> 2. Pointer default (3.4): native pointer by default; water drop is opt-in.
> 3. Pointer placement (3.4): header, beside Text size.
> 4. Role icons (3.1): SVG waves and droplet via `components/role-icon.tsx`.
> 5. Footer wording (3.2): “Youth drops joining elder rivers, for a less lonely world.”
> 6. Header (3.7): option A (`max-w-5xl` content-edge alignment).
> 7. Emoji sweep (4.2): role emoji on login, profile, messages, and thread list replaced with `RoleIcon`; tutorial bullets and search icons deferred.
> 8. Public age bands (3.3): untouched.

**Scope:** small, cross-cutting polish across the login screen, footer, header, text-size control, the water cursor, and secondary text colour. No data, API, or permission changes.

**Baseline:** this plan is written against the current working tree. `components/site-header.tsx` already renders only brand and utilities, and primary navigation lives in `components/site-nav.tsx`, as described in [`header-navigation.md`](./header-navigation.md). Those changes are not committed yet.

---

## 1. Goal

Remove the handful of small problems that make HistorAI feel less polished and less accessible than its intent:

- Decorative emoji on the sign-in role cards render differently across operating systems.
- The footer tagline has a visible typo.
- Secondary text is too faint to meet WCAG AA on the glass surfaces.
- The text-size control is unlabelled, and its buttons' accessible names don't match what is shown.
- The water cursor hides the system pointer for every visitor, with no way to turn it off.
- The header's few items are spread across the full viewport, so they don't line up with the content below.

One item is copy that only the product owner can decide (the age label). It is flagged, not changed.

## 2. Summary of items

| # | Item | Type | Risk | Decision needed? |
|---|---|---|---|---|
| 1 | Emoji on River / Drop role cards | Visual, a11y | Low | Icon style (SVG recommended) |
| 2 | Footer typo "loneli-less" | Copy | Very low | Confirm wording |
| 3 | "Older adult · ages 31+" | Copy and product | None until decided | **Yes**: product owner |
| 4 | Water cursor hides system pointer | Accessibility, behaviour | Medium | **Yes**: default and placement |
| 5 | `text-ink/60` secondary text | Contrast (WCAG AA) | Low | No |
| 6 | Text-size control has no visible label | Clarity, a11y | Low | No |
| 7 | Header items spread too far apart | Layout | Medium (shell) | **Yes**: align vs add centre element |

Recommended order: 2, 5, 6, 1 (low-risk copy, contrast, and labels), then 7 and 4 (shell and preference work), then the emoji sweep in section 4.8 and item 3 once decided.

---

## 3. Items

### 3.1 Emoji on the role cards (`app/login/page.tsx`)

**Current state (verified in the code)**

- `ROLES` sets `icon: "🌊"` for River and `icon: "💧"` for Drop.
- Each icon sits in a `h-16 w-16` tile with `text-4xl` and `aria-hidden="true"`.
- The card's title and subtitle already carry the meaning, so the emoji is decorative only.
- Emoji rendering varies by platform, weight, and size, so the two icons will look inconsistent with each other and with the rest of the UI.
- The droplet shape already appears in the app: it is the water cursor's artwork in `components/water-cursor.tsx`, so reusing it keeps the icons on-brand.

**Target**

- Replace each emoji with a small inline SVG, drawn in `currentColor` and coloured `text-brand`:
  - **River:** two stacked wave strokes (`stroke-width` 2, round caps) in a 24×24 viewBox.
  - **Drop:** the droplet path already used in `components/water-cursor.tsx` (`M12 1.5c0 0 8.6 10.6 8.6 15.7a8.6 8.6 0 1 1-17.2 0C3.4 12.1 12 1.5 12 1.5Z`).
- Keep `aria-hidden="true"`. The card's text names the role.
- Put the two SVGs in one small component, `components/role-icon.tsx`, so the login page and any later role badge share the same artwork.
- Keep the existing tile (`rounded-2xl bg-seaglass/25`) so the card layout does not shift.

**Alternative (acceptable):** remove the tile and icon entirely. The cards already read clearly from the title and subtitle. Choose this if the product owner prefers the calmer look.

**Decision:** SVG (recommended) or no icon.

**Acceptance**

- No emoji remain in `app/login/page.tsx`.
- Both icons are visible at the current tile size and at A++.
- Screen readers announce the card once, with the role title, not the icon.

---

### 3.2 Footer typo (`components/site-footer.tsx`)

**Current state**

- Line 9: `Youth drops joining elder rivers, for a loneli-less world.`
- This is the only occurrence in the repository.

**Target**

- Change to: `Youth drops joining elder rivers, for a less lonely world.`
- Keeps the original sentence structure and meaning.

**Alternative:** `…for a world with less loneliness.` Either is fine. The owner should confirm the wording because it is public-facing.

**Acceptance**

- The footer reads without a hyphenation error at every text size.
- The footer text stays at `text-ink/70` or darker (see 3.5).

---

### 3.3 "Older adult · ages 31+" (flag only, do not change)

**Facts from the code**

- The rule is enforced: `RIVER_MIN_AGE = 31` and `DROP_MIN_AGE = 16`, `DROP_MAX_AGE = 30` in `lib/age.ts`.
- Help says the same: "Rivers must be at least 31" (`app/help/page.tsx`, age FAQ).
- The label also appears on `app/login/page.tsx` (card subtitle), `app/onboarding/page.tsx` (`River · Older adult`), `app/profile/page.tsx` and `app/profile/[id]/page.tsx` (`River · Older adult`).

**Why it may feel wrong**

- "Older adult" is an identity label. A 31-year-old is eligible but may not think of themselves as "older", so the card reads as a judgement about them.
- "31+" is an eligibility threshold. The card mixes the two.

**Related data inconsistency (for the owner to know)**

- `ageBand()` in `lib/users.ts` publishes `18-29` and `30-44`. A Drop aged 30 (the maximum Drop age) therefore shows as `30-44`, a band that mixes Drops and Rivers.
- The `13-17` band cannot occur under the current role rules (Drops are 16+, Rivers are 31+). Verify before relying on this.

**Options for the owner (no change until decided)**

- **A.** Keep the copy as is. It is accurate to the rule.
- **B.** Use an eligibility line and a plain identity line, e.g. subtitle `Ages 31 and over` and description text that says "share your experience" rather than "older adult".
- **C.** Remove the age from the card and state the rule once in the body text and Help.

**Recommendation to put to the owner:** separate the identity term (River) from the eligibility rule (31 and over). Option B is the smallest change that does this.

**Decision:** owner chooses A, B, or C. If the public age bands change, that needs a separate plan because it touches the stored profile model (`lib/types.ts` `AgeBand`).

---

### 3.4 Water cursor hides the system pointer (`components/water-cursor.tsx`, `app/globals.css`)

**Current state (verified in the code)**

- `WaterCursor` is mounted in `app/layout.tsx` and turns on whenever the device has a fine pointer (`(pointer: fine)`) and the OS does not request reduced motion.
- When it turns on, it adds `water-cursor-active` to `<html>`. `app/globals.css` then sets `cursor: none !important` on the whole document and all its descendants. The system pointer disappears everywhere, including over text fields, where the I-beam is hidden too.
- The droplet follows the pointer with easing (`0.4` per frame), so it lags slightly behind the real input.
- A click spawns a splash of 5–8 droplets that fall over about one second.
- There is no in-app way to turn this off. Only the OS-level reduced-motion setting disables it, and most people don't set that.

**Why it matters**

- People with low vision may use the OS pointer size or high-contrast cursor settings, a screen magnifier, or a large-cursor theme. Hiding the native pointer bypasses all of them.
- People with motor difficulties may depend on a pointer they can predict; a lagging substitute is harder to aim precisely.
- The splash adds motion on every click for users who did not ask for it.

**Target**

- **Default: the native pointer.** Remove `water-cursor-active` unless the user has turned the water pointer on. Nothing is hidden by default.
- **Opt-in switch: "Water drop pointer".** When on, behaviour is exactly as today (droplet, easing, click splash). It is off by default.
- The switch is a `role="switch"` button with `aria-checked`, a visible label, and a visible on/off state (not colour alone).
- Preference is stored in `localStorage` under a new key, `historai:pointer-style` (`"system"` or `"water"`). Do not rename the existing `crosscurrent:text-size` key; renaming it would reset people's text size.
- Reduced motion still forces the system pointer, regardless of the switch.
- Implementation shape:
  - `WaterCursor` reads the preference in its effect. When the preference is `system`, it returns before adding classes or listeners.
  - The switch updates `localStorage` and dispatches a `historai:pointer-change` event, which `WaterCursor` listens for. The existing effect cleanup already removes listeners and classes, so toggling off is clean.
  - Keep the CSS rule scoped to `.water-cursor-active`. Do not change the dialog fallback (`.water-cursor-native`).

**Decision:** two choices for the owner.

1. *Default.* Native pointer by default (recommended), or droplet on by default with the switch available.
2. *Placement.* In the header beside Text size (recommended, since both are display preferences and it makes the header less sparse; see 3.7), or only on the profile page.

**Acceptance**

- With no stored preference, `document.documentElement` does not have `water-cursor-active`, and `getComputedStyle(document.body).cursor` is `auto`.
- Turning the switch on shows the droplet immediately, without reload. Turning it off restores the system pointer immediately.
- The choice survives a reload.
- Inputs and text areas show the system I-beam when the switch is off.
- With reduced motion enabled, the droplet never appears, even if the switch is on.
- The switch is reachable by keyboard (Tab, Space) and has a visible focus ring.

---

### 3.5 Low-contrast secondary text (`text-ink/60`)

**Current state (verified in the code)**

`text-ink/60` appears 14 times in 9 files:

| File | Count |
|---|---|
| `components/podcast/podcast-builder.tsx` | 4 |
| `components/tutorial/tutorial-provider.tsx` | 3 |
| `components/story-card.tsx` ("From the question:") | 1 |
| `components/like-match-dialog.tsx` | 1 |
| `components/chat/message-thread.tsx` | 1 |
| `components/chat/message-composer.tsx` | 1 |
| `components/chat/connect-directory.tsx` | 1 |
| `app/youth/[id]/page.tsx` ("Answering:") | 1 |
| `app/search/page.tsx` (input placeholder) | 1 |

**Measured contrast** (ink `#0c2a45` at the stated opacity over the actual surfaces; WCAG relative luminance)

| Surface | `text-ink/60` | `text-ink/70` | `text-ink/80` |
|---|---|---|---|
| Glass card (`bg-white/60` over the page gradient) | **3.99–4.07:1** | 5.38–5.52:1 | 7.38–7.63:1 |
| `bg-surface` / `bg-mist` (`#cfe8f3`) | **3.75:1** | 4.96:1 | — |
| `bg-seaglass/25` over canvas | **3.71:1** | 4.89:1 | — |
| Pure white (`bg-white`) | 4.12:1 | — | — |

- The estimate of "around 4:1" is confirmed.
- Body text in this app is `text-base` (18px at the default root size), which is "normal" text. AA requires **4.5:1**. `text-ink/60` fails on every surface measured.
- `text-ink/70` passes on every surface measured, with a lowest value of 4.89:1.

**Target**

- Replace every `text-ink/60` used for text with `text-ink/70`.
- On tinted surfaces (`bg-surface`, `bg-mist`, `bg-seaglass/…`) and for any `text-sm` or smaller text, use `text-ink/80`, which gives margin above the threshold.
- The search placeholder (`placeholder:text-ink/60`) is text too. Change it to `placeholder:text-ink/70`.
- Do not change the 66 existing `text-ink/70` uses. They already pass.
- Do not change the palette or the ink colour; this is an opacity-level fix only.

**Guard against regression**

- Add a line to the review checklist (or a one-line `rg` check in the handover notes): `rg "text-ink/(40|50|60)" app components lib` should return nothing.

**Acceptance**

- No `text-ink/60` or lower remains on text.
- Spot-check in the browser's contrast tool on the story card, tutorial, search, and podcast builder at A++.

---

### 3.6 Text-size control has no visible label (`components/text-size-toggle.tsx`)

**Current state (verified in the code)**

- The group has `aria-label="Text size"`, which screen readers announce but sighted users never see.
- The buttons show **A**, **A+**, **A++** with no visible context.
- The button accessible names are "Standard text size", "Large text size", and "Extra large text size". These do not contain the visible labels "A", "A+", and "A++". This fails **WCAG 2.5.3 Label in Name** for speech-input users who say what they see ("click A+").

**Target**

- Add a visible label **"Text size"** before the buttons:
  - Element: `<span id="text-size-label">` with `text-sm font-medium text-white/80`.
  - Contrast on the ocean header is about 9.8:1 for `text-white/80`, so it passes.
  - The group uses `aria-labelledby="text-size-label"` and drops the duplicate `aria-label`.
- Change each button's accessible name so it contains the visible label:
  - `A` → `A: standard text size`
  - `A+` → `A+: large text size`
  - `A++` → `A++: extra large text size`
- Keep `aria-pressed`, `title`, and the existing `data-tour="text-size"` hook.
- Keep the label visible at all widths. Do not hide it to save space; check the header width instead (see 3.7).

**Alternatives considered**

- A label above the buttons. Rejected: the header is a fixed `4.5rem` tall, and a second line would crowd it.
- An icon instead of text. Rejected: the brief is for people who may not recognise an icon.

**Acceptance**

- "Text size" is visible in the header at 1024, 1280, and 1920 widths, at A, A+, and A++.
- Each button's accessible name starts with its visible label.
- The header still fits on one row at A++ (see 3.7).

---

### 3.7 Header items spread too far apart (`components/site-header.tsx`, `app/layout.tsx`)

**Current state (verified in the code)**

- The header wrapper is `w-full px-6` with `justify-between`. Brand sits at the left edge of the viewport and the utility group at the right edge.
- Page content is `max-w-5xl` and centred in the column to the right of the 15rem rail (`components/site-nav.tsx`, `w-60`).
- Result: the header's edges don't line up with the content, and on a wide screen the utility group sits well to the right of the content's right edge. At 1920px the offset is roughly 200–250px. This is my estimate from the layout math; confirm it in the browser.
- With only brand, text size, profile, and sign-out (or sign-in) in the header, the empty middle makes the controls look isolated.
- `header-navigation.md` says "brand left; text-size, profile, and sign-in/out right". That remains the intent. This item refines the spacing and alignment within that structure.

**Options**

- **A. Align the header with the content column (recommended).** Wrap the header's inner row in the same centred `max-w-5xl` box as the page content, keeping `justify-between`. Brand and utilities then line up with the content's left and right edges. The header reads as part of the same column.
- **B. Keep brand over the rail and align utilities with the content.** Use a two-column header grid at `lg`: column 1 (`15rem`) holds the brand, and column 2 holds the utilities in a `max-w-5xl` box, justified to the end. This keeps brand and rail aligned. The gap between the two groups remains wide on large screens.
- **C. Add a centred element to the header**, such as a search field that submits to `/search`. This fills the space and gives the header a purpose. It is a small feature addition, so it needs approval.

**Recommendation:** A now. Revisit C once the owner has seen A, since a centred search would also duplicate the rail's Search link.

**Decision:** A (recommended), B, or C. If C is chosen, a separate plan is needed for the search behaviour.

**Acceptance**

- At 1024, 1280, 1440, 1920, and 2560 widths, the brand's left edge and the utility group's right edge are within 1px of the page content's edges (option A) or the rail/content edges (option B).
- The header stays on one row at A, A+, and A++, including with the new "Text size" label (3.6) and the pointer switch (3.4), if placed there.
- No horizontal scrolling appears at any tested width.

---

## 4. Supporting work

### 4.1 Changed-file summary by item

| Item | Files |
|---|---|
| 3.1 | `app/login/page.tsx`; new `components/role-icon.tsx` |
| 3.2 | `components/site-footer.tsx` |
| 3.3 | none until decided (`app/login/page.tsx`, `app/onboarding/page.tsx`, `app/profile/page.tsx`, `app/profile/[id]/page.tsx`, `app/help/page.tsx`, `lib/age.ts` if the rule changes) |
| 3.4 | `components/water-cursor.tsx`; new `components/pointer-toggle.tsx`; `components/site-header.tsx` if placed in the header; `app/globals.css` only if the selector needs tightening |
| 3.5 | `components/podcast/podcast-builder.tsx`, `components/tutorial/tutorial-provider.tsx`, `components/story-card.tsx`, `components/like-match-dialog.tsx`, `components/chat/message-thread.tsx`, `components/chat/message-composer.tsx`, `components/chat/connect-directory.tsx`, `app/youth/[id]/page.tsx`, `app/search/page.tsx` |
| 3.6 | `components/text-size-toggle.tsx` |
| 3.7 | `components/site-header.tsx`; possibly `app/layout.tsx` |

### 4.2 Emoji sweep (same pattern, outside the login page)

The role-card request applies equally to other emoji used for roles or as icons. These are not required for the login fix, but leaving them creates inconsistency. **Decision:** include in this pass or in a follow-up.

- `components/tutorial/tutorial-provider.tsx` lines ~494 and ~498 (`🌊`, `🎙️` as bullet markers)
- `components/chat/thread-list.tsx` line ~33 (`🌊` / `💧`)
- `app/messages/[threadId]/page.tsx` line ~58 (`🌊` / `💧`)
- `app/profile/[id]/page.tsx` line ~71 (`🌊` / `💧`)
- `app/search/page.tsx` line ~16 (`❓` as a section icon)

Recommendation: replace role emoji with `RoleIcon` from 3.1. For the tutorial bullets and search icon, use either a simple SVG or no icon, following the same rule.

Not in scope: text glyphs such as the `→` in "Continue →", which are typography and render consistently.

### 4.3 Storage keys

- Existing: `crosscurrent:text-size`. Keep it.
- New: `historai:pointer-style`. Use this for 3.4.
- Note the naming difference in the handover so a future agent does not "fix" the old key.

---

## 5. Phases and order

1. **Copy and contrast (low risk).**
   - 3.2 footer typo.
   - 3.5 `text-ink/60` sweep.
2. **Labels and icons.**
   - 3.6 text-size label and accessible names.
   - 3.1 role icons (after the icon style decision).
3. **Shell and preferences (needs decisions first).**
   - 3.7 header alignment, option per decision.
   - 3.4 pointer switch and native default.
4. **Emoji sweep (4.2)**, if approved.
5. **Owner input.** 3.3 age label, once the owner has chosen an option. No code until then.

Keep each phase as its own small diff so the shell changes (3.7, 3.4) can be reviewed without the copy changes.

---

## 6. Accessibility requirements

- Body text meets WCAG AA (4.5:1) on every glass and tinted surface, at all text sizes.
- Every visible control has a visible label, and its accessible name contains that label.
- Preference switches are keyboard operable and expose their on/off state via `aria-checked`, not colour alone.
- The system pointer is never hidden by default.
- Reduced motion is respected: no droplet, no splash, no animated pointer.
- Icons are decorative (`aria-hidden`) and never the only way to identify a role or control.
- Focus rings remain visible on new controls (the global `:focus-visible` rule covers them).

---

## 7. Testing

- `npm run build` passes.
- Visual check at 1024, 1280, 1440, 1920, and 2560 widths, at A, A+, and A++:
  - header alignment and single-row layout;
  - "Text size" label visible;
  - login role cards (icons or no icon).
- Contrast check on the story card, tutorial dialog, search input, podcast builder, and message composer, using the browser's contrast tool or the same method as section 3.5.
- Cursor check:
  - default: native pointer everywhere, including over inputs;
  - switch on: droplet appears and splashes on click;
  - switch off after on: native pointer restored without reload;
  - reduced motion on: no droplet regardless of the switch.
- Keyboard-only pass: Tab through the header (label → A → A+ → A++ → pointer switch → profile → sign out) and activate the pointer switch with Space.
- Screen reader spot-check (VoiceOver or NVDA): text-size group announces "Text size", and each button announces its visible label first.
- Speech-input spot-check: saying "click A plus" should activate the A+ button.
- No new dependencies. Playwright is present in `node_modules` as an indirect package but is not declared in `package.json`; do not start using it without approval.

---

## 8. Acceptance criteria

- The login role cards contain no emoji; each icon is decorative and the role is named by text.
- The footer reads "…for a less lonely world." (or the owner's chosen wording).
- No `text-ink/60` (or lower) remains on text; the search placeholder meets 4.5:1.
- The text-size group has a visible "Text size" label, and every button's accessible name contains its visible label.
- By default the system pointer is visible everywhere. The water drop pointer is opt-in, persists across reloads, and is disabled under reduced motion.
- The header's brand and utility group align with the page content edges at all tested widths, and the header stays on one row at A++.
- The age label is unchanged until the owner decides; the decision is recorded in this file.
- `npm run build` passes.

---

## 9. Non-goals

- No change to the age rules, the Drop/River eligibility limits, the public age bands, or the `AgeBand` type.
- No change to the colour palette or the ink colour itself. Only the opacity level of secondary text changes.
- No change to the existing 66 `text-ink/70` uses.
- No mobile or narrow-screen navigation (still out of scope per `header-navigation.md`).
- No server, API, or data changes, and no seeded-data edits.
- No new dependencies.
- No removal of the water drop pointer. It remains available as an opt-in.
- No renaming of the `crosscurrent:text-size` storage key.

---

## 10. Open questions for the product owner

1. **Age label (3.3):** keep "Older adult · ages 31+", change to "Ages 31 and over" (or similar), or remove the age from the card?
2. **Pointer default (3.4):** native pointer by default (recommended), or droplet on by default with a switch?
3. **Pointer placement (3.4):** header beside Text size (recommended), or profile page only?
4. **Role icons (3.1):** simple SVG waves and droplet (recommended), or no icon?
5. **Footer wording (3.2):** "for a less lonely world" or "for a world with less loneliness"?
6. **Header (3.7):** align with content (recommended), keep brand over the rail, or add a centred search field?
7. **Emoji sweep (4.2):** include the other emoji locations in this pass, or defer?
8. **Public age bands (3.3):** is `30-44` meant to appear for a 30-year-old Drop, and is the `13-17` band still needed?

---

## 11. Handover checklist for the implementing agent

1. Confirm the decisions in section 10 are recorded here before starting the affected items.
2. Read the current `components/site-header.tsx`, `components/site-nav.tsx`, and `app/layout.tsx`. Their working-tree state is the baseline.
3. Implement in the phase order in section 5. Keep each phase as a separate diff.
4. Do not change any `lib/age.ts`, `lib/users.ts`, or data files as part of this plan.
5. Keep the `crosscurrent:text-size` key. Add `historai:pointer-style` for the new preference.
6. Run the contrast regression check in 3.5 and the build in section 7 before reporting completion.
7. Report: changed paths, decisions taken, checks run (and any not run), and the outcome of the owner's age-label decision.
