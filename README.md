# Zoca Sales Academy

An internal sales & AE enablement training site for the Zoca product suite. Static — no backend, no database. Login is checked against a JSON roster; lesson progress and quiz scores are stored per user in the browser's `localStorage`.

> **Security note:** `data/users.json` holds login credentials **in plaintext**, readable by anyone who can view the deployed files or the repo. This is a low-stakes internal gate, **not real authentication**. Do not reuse real/sensitive passwords, and keep the repo's visibility in mind (see Deploying).

## What's inside

- **Foundations** — concept primers (web-researched, with citations): Local SEO, AEO/GEO, AI Voice, Reviews & Reputation, Google Business Profile, SEO & Content.
- **Product training** — Discovery, Front Desk, Scheduling, Brain, Command Center, Onboarding.
- **Selling Zoca** — buyer personas, the pitch narrative, the sales process & deal mechanics, and the master objection bank.
- Every module ends in a **knowledge-check quiz**; every track has a **final assessment** that awards a **certification badge**.

## Run locally

It must be served over HTTP (the app fetches JSON, which `file://` blocks):

```bash
python3 -m http.server 8731
# then open http://localhost:8731/index.html
```

Demo logins (see `data/users.json`): `demo@zoca.com` / `zoca2026`.

## Add or change users

Edit `data/users.json`:

```json
[{ "email": "you@zoca.com", "password": "choose-one", "name": "Your Name" }]
```

Progress is keyed by email, so each person's progress is separate (per browser).

## Edit or add lesson content

Lessons are generated from Markdown — **do not hand-edit files in `content/`** (they're overwritten).

- Product lessons come from the `product-docs` repo's `ae-training/*.md` (path configured in `tools/generate.js`).
- Foundations & Selling lessons are authored in `tools/src/foundations/` and `tools/src/selling/`.
- Quizzes live in `data/quizzes.json`, keyed `"<trackId>/<moduleId>"` and `"<trackId>/__final__"`.

After editing any source, regenerate:

```bash
node tools/generate.js
```

This rewrites `content/*.html` and `data/curriculum.json`. Markdown supports `> [!LABEL] ...` callouts, tables, lists, and links.

## Deploying (GitHub Pages)

All asset paths are relative, so it works at a project-pages subpath. Enable Pages on the default branch, root folder.

- **Public repo** → free Pages, but the site **and `users.json` are visible to the whole internet**, as is all internal sales content (team/process/objection scripts). Only choose this if that exposure is acceptable.
- **Private repo** → keeps content internal, but Pages on private repos requires a paid GitHub plan for the org; otherwise distribute the folder/zip internally or host behind your own access control.

## Project layout

```
index.html            login + app shell
assets/app.js         auth, hash router, progress + quiz engine
assets/styles.css     theme (Zoca maroon/cream LMS look)
data/users.json       login roster (plaintext)
data/curriculum.json  generated: tracks → modules → quizzes
data/quizzes.json     hand-authored quiz bank (source)
content/<track>/*.html generated lesson fragments (do not edit)
tools/generate.js     Markdown → lessons + curriculum builder
tools/src/            authored Foundations + Selling markdown
```
