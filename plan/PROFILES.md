# HistorAI — Profiles, Roles & Ownership Plan

> Status: **implemented.** See §6 build order and §7 acceptance criteria.
> Scope: login/role choice, user profiles (name + age), and linking every question,
> answer, and conversation to a user. Messaging/matching is explicitly deferred.
> Companion to [`ROADMAP.md`](./ROADMAP.md) and [`../MVP.md`](../MVP.md).

---

## 1. Product terminology

Water is the metaphor for wisdom — a **River** is a long, deep accumulation of it.

| Concept | Code role id | Display label | Meaning |
|---------|--------------|---------------|---------|
| Older adult | `river` | **River** | Shares their knowledge and answers questions |
| Young person | `drop` | **Drop** | Asks questions and learns from Rivers |

- All user-facing copy uses **River** / **Drop**.
- Existing `senior` / `youth` wording in code is replaced by `river` / `drop` as the
  canonical role values.
- Route paths: keep `/senior` and `/youth` for this iteration to limit churn, and add
  `/river` / `/drop` redirects later. (Minor follow-up; not required for the feature.)

---

## 2. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Authentication model | **Lightweight identity, no passwords.** Pick a role, enter name + age. |
| 2 | Minor safety | **Collect exact age; store/display an age band only.** Under-13 blocked. No 1-on-1 messaging this iteration. |
| 3 | Role source | **Chosen explicitly at login**, not derived from age. Age is for display/safety only. |
| 4 | Role split | **Reading is shared/public; authoring is role-gated.** Drops can view a River's public profile and stories, not the recording/review screens. |
| 5 | Who can ask questions | **Drops only.** Rivers answer. |
| 6 | Login requirement | **Public read; login required to post/answer.** App opens on `/login` and redirects after login. |
| 7 | Profile fields | **Name + age are mandatory.** Bio and interests optional (interests seed later matching). |
| 8 | Multiple accounts/device | Not needed yet. |
| 9 | Existing seed data | **Seed 2–3 demo users** and assign existing questions/stories to them. |
| 10 | Naming | **River** (older) and **Drop** (young). |
| 11 | Editable profiles | Yes — edit name/age/interests from `/profile`. |
| 12 | Session | **Signed, httpOnly cookie** (user id + role), verified server-side. No JWT library, no DB. |

---

## 3. Target flows

```
First visit
   │
   ▼
/login  ──►  "How do you want to continue?"
             ┌────────────────┐   ┌────────────────┐
             │  I'm a River   │   │  I'm a Drop    │
             │ (older adult)  │   │ (young person) │
             └───────┬────────┘   └───────┬────────┘
                     └─────────┬──────────┘
                               ▼
                    /onboarding  (name + age)
                               ▼
                       session cookie set
                               ▼
          role-aware home • /profile • logout
```

- **`/login`** — role choice, two large accessible cards, plus **"Continue as a visitor"**
  (read-only: can read everything, cannot ask or answer). No password.
- **First visit** — `/` redirects to `/login` until a role is chosen or the visitor
  option is taken (a session-scoped `historai_visitor` cookie).
- **`/onboarding`** — mandatory name + age; optional bio + interests. Creates a `User`.
- **`/profile`** — the signed-in user's own profile (edit in place).
- **`/profile/[id]`** — public profile: name, age band, role, bio/interests, and that
  user's contributed questions (Drop) or published stories (River).
- **Header** — profile button links to `/profile`; shows current name; `Log out` action.

---

## 4. Data model additions

### New: `data/users.json`

```jsonc
{
  "users": [
    {
      "id": "u-...",
      "role": "river" | "drop",
      "name": "Ruth",
      "age": 78,                 // exact; never shown publicly
      "bio": "",                 // optional
      "interests": ["family"],   // optional; seeds later matching
      "createdAt": "ISO timestamp"
    }
  ]
}
```

- Public rendering uses an **age band** derived from `age`, not the exact number.
  Bands: `under-13` (blocked), `13-17`, `18-29`, `30-44`, `45-59`, `60-74`, `75+`.
- `lib/users.ts` mirrors `lib/store.ts` / `lib/questions.ts`: `getUser`, `createUser`,
  `updateUser`, `listUsers`, using the shared `mutateJson` lock.

### `Story` — add author

```jsonc
"authorId": "u-..." | null
```

### `Question` — reuse existing field as user link

```jsonc
"askedBy": "u-..." | null   // now the Drop's user id, resolved to a display name
```

### `Conversation` — add owner

```jsonc
"userId": "u-..." | null
```

`null` renders as **"HistorAI community"** so old seed rows still display.

### `lib/session.ts` (new)

- Writes/reads one HMAC-signed cookie: `{ userId, role }`.
- HttpOnly, SameSite=Lax, `Secure` in production.
- `getSession()`, `requireSession(role?)`, `setSession()`, `clearSession()`.
- One-file swap to Supabase Auth later; nothing else changes.

---

## 5. Route access & guards

| Route | Access |
|-------|--------|
| `/login`, `/onboarding` | Public |
| `/`, `/questions`, `/questions/[id]`, `/youth`, `/youth/[id]`, `/profile/[id]` | Public read |
| Post question, upvote, answer | Logged in; posting question = `drop` only |
| `/senior*` (record/review/approve) | Logged-in **`river`** only |
| `/profile` (self, edit) | Logged in |

- Enforced with a `middleware.ts` redirect **and** a server-side check in every API
  handler. The client is never trusted for role.
- API write routes (`/api/questions`, `/api/intake`, `/api/conversation`, `/api/approve`)
  attach the session user id to the created resource server-side — the client cannot
  choose an author.

---

## 6. Build order

| Step | Outcome | Touches |
|------|---------|---------|
| P1 | `users.json` + `lib/users.ts` + `lib/session.ts` | Data + lib |
| P2 | `/login`, `/onboarding`; header shows user + logout | UI |
| P3 | `middleware.ts` + route/API guards; role-aware nav | App + API |
| P4 | Attach `authorId` / `askedBy` / `userId` on create | API + lib |
| P5 | Render author names on cards, question detail, story detail | UI |
| P6 | `/profile` (edit) + `/profile/[id]` (public) | UI |
| P7 | Seed demo Rivers/Drops; assign existing seed content | Data |
| P8 | Polish, a11y check, demo rehearsal | Both |

---

## 7. Acceptance criteria

- **AC-P1** — A first-time user chooses River or Drop, enters name + age, and lands on
  their role-appropriate view.
- **AC-P2** — Exact age is never shown publicly; only the age band.
- **AC-P3** — Under-13 users cannot create an account.
- **AC-P4** — A Drop can post a question; the question shows the Drop's name and links
  to their public profile.
- **AC-P5** — A River's published story shows the River's name and links to their
  public profile.
- **AC-P6** — A Drop cannot reach `/senior*` or any answer/approve API; a River cannot
  post a question.
- **AC-P7** — API-created resources derive the author from the session, never from the
  request body.
- **AC-P8** — Logging out clears the session; reading still works logged out.
- **AC-P10** — A first-time visitor lands on `/login`; choosing "visitor" reaches the
  home page and can read, but the "Answer a question" button is hidden and posting
  returns `401`.
- **AC-P11** — The "Answer a question" button appears only for signed-in Rivers.
- **AC-P9** — Existing seed content with `null` authors still renders.

---

## 8. Out of scope (deferred)

- 1-on-1 messaging / connections / matching (needs the `C-TRUST-*` safety layer).
- Passwords, email, magic links, real auth provider, persistent DB.
- Guardian consent flow for 13–17 (flagged as a risk; revisit before messaging).
- Institution accounts.
- Renaming route paths to `/river` / `/drop`.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Adult↔minor contact | No direct messaging this iteration; age band, not exact age; under-13 blocked |
| Signed-cookie forgery | HMAC with a server secret from env; verify every request |
| Seed data with no authors | Render `null` as "HistorAI community" |
| Role confusion from old route names | Keep labels explicit in UI; plan `/river`/`/drop` rename with redirects |
| Scope creep into chat | This file and `MVP.md` are the scope source of truth |
