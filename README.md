# Multi-user GitHub PR summarizer agent

> 📖 **Cookbook:** [Build a multi-user GitHub PR summarizer agent](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)
>
> 🎬 **Video walkthrough:** [Watch the setup demo on YouTube](https://youtu.be/w3atzSkKE1w)
>
> 🚀 **Live demo:** [render-pr-summarizer on Render](https://render-pr-summarizer.onrender.com/)

This sample shows how to build a GitHub PR summarizer where each browser session connects its own GitHub account once, then uses that connected token for later tool calls. The server never asks the browser for a `userId`.

The app finds the five most-discussed open pull requests in a repository, fetches each PR's diff and comment thread through Scalekit's GitHub connector, then calls an OpenAI-compatible chat model to produce a plain-language summary.

## Why this version is secure

The server mints an opaque identifier on the server side and stores it in its own session record. The browser only carries a signed, HTTP-only session cookie.

That design matters because the connected GitHub token is stored in Scalekit under the identifier you provide. If you let the browser choose that identifier, one user can point requests at another user's stored token. This sample avoids that cross-user impersonation bug by binding the identifier to the server-side session and completing the OAuth flow with Scalekit's user verification callback.

See [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/) for the full Scalekit flow.

---

## Setup guide (Scalekit ↔ GitHub ↔ Render)

Setup is confusing because **three products** each own a different piece of OAuth:

| Product | What it owns in this sample |
|---------|-----------------------------|
| **Scalekit** | AgentKit app credentials, GitHub **connector**, OAuth **Redirect URI**, user verification |
| **GitHub** | OAuth App (Client ID/secret used *by Scalekit’s connector*), **Authorization callback URL** |
| **Render** (or local Node) | Runs this web app, holds env secrets, serves `https://….onrender.com` / `localhost:3000` |

**Critical mental model:** the browser never completes OAuth “with your Render URL.”  
GitHub redirects to **Scalekit**. Scalekit stores the connected GitHub token. This app only asks Scalekit for tool calls using a **session-bound** identifier.

### Recommended order (do not skip steps)

```text
A. Scalekit  → API credentials + GitHub connector (copy connection name + Redirect URI)
B. GitHub    → OAuth App callback = Scalekit Redirect URI  ← not Render, not localhost
C. Scalekit  → User verification mode (required before first Connect GitHub)
D. LLM       → OpenAI project key or LiteLLM virtual key + model
E. Env       → local .env and/or Render Environment
F. Run       → local npm run dev  OR  Deploy to Render
G. Browser   → Connect GitHub → paste repo → Summarize PRs
```

Keep a notepad open while you flip tabs — you will copy values from Scalekit into GitHub, then from Scalekit/OpenAI into Render.

---

### A. Scalekit — environment credentials

1. Open [app.scalekit.com](https://app.scalekit.com) and select the environment you will use (dev/demo/prod).
2. Go to **Developers → API Credentials**.
3. Copy and save (you will paste these into `.env` / Render later):
   - **Environment URL** → `SCALEKIT_ENVIRONMENT_URL` (e.g. `https://….scalekit.com`)
   - **Client ID** → `SCALEKIT_CLIENT_ID`
   - **Client secret** → `SCALEKIT_CLIENT_SECRET`

Stay in this Scalekit environment for the rest of setup. Mixing credentials from env A with a connector from env B breaks OAuth.

---

### B. Scalekit — GitHub connector

1. In the **same** Scalekit environment: **AgentKit → Connectors**.
2. Add (or open) a **GitHub** connector.
3. Copy and save:
   - **Connection name** (e.g. `github-qkHFhMip`) → `GITHUB_CONNECTION_NAME`  
     Optional: this repo defaults to `github-qkHFhMip` for the public sampleapps Render demo only. **Your** environment almost always needs its own name.
   - **Redirect URI** shown on the connector (Scalekit URL — looks like a Scalekit host/path, **not** your Render URL).

Leave this tab open; the Redirect URI is what GitHub must use next.

Details: [AgentKit connectors](https://docs.scalekit.com/agentkit/connectors/).

---

### C. GitHub — OAuth App (callback into Scalekit)

You are configuring the OAuth App that **Scalekit’s connector** uses to talk to GitHub.

1. GitHub → **Settings → Developer settings → OAuth Apps**  
   (or your org: **Settings → Developer settings → OAuth Apps**).
2. Create an OAuth App (or edit the one Scalekit/docs told you to use).
3. Set **Authorization callback URL** to the **exact Scalekit Redirect URI** from step B.
4. **Do not** set the callback to:
   - `https://your-service.onrender.com`
   - `https://your-service.onrender.com/user/verify`
   - `http://localhost:3000`
5. Save. If Scalekit’s connector UI asks for GitHub Client ID / Client secret, paste them from this OAuth App into the connector and save in Scalekit.

**Why:** GitHub only allows one primary callback. That callback must be Scalekit so Scalekit can store the connected account. Your app later receives session activation via user verification / polling — not via GitHub hitting Render directly.

---

### D. Scalekit — user verification (required)

Do this **before** clicking Connect GitHub in the app.

1. Scalekit → **AgentKit → Settings → User verification** (wording may be under AgentKit settings).
2. Choose a mode:

| Mode | Use when | What happens after GitHub OAuth |
|------|----------|----------------------------------|
| **Scalekit users only** | Local dev / demos | Scalekit marks the connection active. This app polls `/api/auth/status` and reloads. |
| **Custom user verification** | Production-style | Scalekit redirects to **your app** at `/user/verify`. The server calls `verifyConnectedAccountUser`. Polling remains a fallback. |

3. For **Custom user verification**, Scalekit must be able to reach your public app URL (Render). Localhost only works if you use a tunnel Scalekit can call, or stick to **Scalekit users only** for local demos.

If you skip this step, the UI almost always sticks on **Waiting for GitHub authorization** even when GitHub OAuth “succeeded.”

Full reference: [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/).

---

### E. LLM credentials (OpenAI or LiteLLM)

Pick **one** path. Do not mix an OpenAI project key with a LiteLLM base URL unless that key is registered on the proxy.

**OpenAI direct**

| Env | Value |
|-----|--------|
| `OPENAI_API_KEY` | Project key (`sk-proj-…`) — [scope permissions](#openai-api-key--scope-permissions-least-privilege) |
| `OPENAI_BASE_URL` | **Unset / delete** (do not leave a LiteLLM URL) |
| `OPENAI_MODEL` | e.g. `gpt-5-mini` |

**LiteLLM / OpenAI-compatible proxy**

| Env | Value |
|-----|--------|
| `OPENAI_API_KEY` | Proxy **virtual key** (must exist in that proxy’s key table) |
| `OPENAI_BASE_URL` | Proxy base **including `/v1`** (e.g. `https://llm.example.com/v1`) |
| `OPENAI_MODEL` | An id from `GET {OPENAI_BASE_URL}/models` for that key (e.g. `claude-haiku-4-5`) |

---

### F. Environment variables — local and/or Render

#### Local

```bash
cp .env.example .env
npm install
# edit .env with values from steps A–E
openssl rand -hex 32   # paste into SESSION_SECRET
```

#### Render

1. Deploy (step G) **or** open an existing service → **Environment**.
2. Set the same secrets as local (table below).
3. Prefer **deleting** unused vars rather than leaving them blank:
   - Empty `OPENAI_API_KEY=""` does **not** fall back to `LITELLM_API_KEY`.
   - Empty `OPENAI_BASE_URL` may still be “set”; for OpenAI direct, **delete** `OPENAI_BASE_URL` if it previously pointed at a proxy.
4. Save → wait for redeploy.

| Variable | Where it comes from | Required |
|----------|---------------------|----------|
| `SCALEKIT_ENVIRONMENT_URL` | Scalekit → Developers → API Credentials | Yes |
| `SCALEKIT_CLIENT_ID` | Same | Yes |
| `SCALEKIT_CLIENT_SECRET` | Same | Yes |
| `GITHUB_CONNECTION_NAME` | Scalekit → AgentKit → Connectors (connection name) | Recommended (defaults only for sampleapps demo) |
| `OPENAI_API_KEY` | OpenAI project key or LiteLLM virtual key | Yes |
| `OPENAI_MODEL` | OpenAI model id or proxy catalog id | No (default `gpt-5-mini`) |
| `OPENAI_BASE_URL` | Empty for OpenAI; proxy `…/v1` for LiteLLM | Path-dependent |
| `SESSION_SECRET` | `openssl rand -hex 32` (Render Blueprint can auto-generate) | Recommended on Render |
| `PUBLIC_BASE_URL` | Your public app URL | Optional on Render (auto from headers); set if custom domain / bad proxy headers |
| `PORT` | Usually `3000` | Optional (Render sets PORT) |

Optional aliases (fallbacks only if the `OPENAI_*` var is **unset**, not empty): `LITELLM_API_KEY`, `LITELLM_BASE_URL`, `LITELLM_MODEL`. Prefer a single `OPENAI_*` set to avoid confusion.

---

### G. Run the app

#### Option 1 — local

```bash
npm run dev
# open http://localhost:3000
```

#### Option 2 — Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit)

Or connect this repo and deploy with `render.yaml`:

1. Create / open the web service.
2. Paste env vars from step F (Blueprint may prompt for secrets on first deploy).
3. Start command is `npm run start:webhook` / `node dist/main.js` (see `package.json`).
4. After the service is live, if you use **Custom user verification**, confirm Scalekit can reach `https://<your-service>.onrender.com/user/verify`.
5. Open the Render URL in a browser and continue to step H.

`SESSION_SECRET`: set explicitly, or rely on Blueprint `generateValue` when using `render.yaml`. Dashboard-only deploys that omit it get an ephemeral secret (sessions reset on restart).

---

### H. First successful run in the browser

1. Open the app URL (local or Render).
2. Click **Connect GitHub** — a **new tab** opens for GitHub OAuth (via Scalekit).
3. Approve access on GitHub; finish any Scalekit / verification step.
4. Return to the **original** tab — it should show **GitHub connected** (the page polls every few seconds).
5. Paste a public `owner/repo` or GitHub URL → **Summarize PRs**.
6. Wait for the summary panel (LLM can take up to ~2 minutes).

Public repos work with any connected account. Private repos require that the connected GitHub user (and OAuth app / org approval) can access the repo.

---

### Who talks to whom (OAuth)

```text
Browser                This app (Render/local)         Scalekit              GitHub
   |                          |                           |                    |
   |-- Connect GitHub ------->|                           |                    |
   |                          |-- auth link ------------->|                    |
   |<-- open new tab ---------|                           |                    |
   |------------------------------ GitHub OAuth (callback = Scalekit URI) ---->|
   |                          |                           |<-- code/token -----|
   |                          |<-- user verify / poll ----|                    |
   |-- Summarize ------------>|-- GitHub tools via Scalekit ------------------>(API)
   |                          |-- chat.completions ------> OpenAI or LiteLLM
```

---

### Common mistakes

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Stuck on “Waiting for GitHub authorization” | User verification mode not set | Step D |
| OAuth error / redirect_uri mismatch | GitHub callback is Render or localhost | Step C — must be Scalekit Redirect URI |
| `GITHUB_CONNECTION_NAME` / connector errors | Wrong env or wrong connection name | Steps A–B — same Scalekit environment |
| `401` on summarize before LLM | Session never connected | Complete step H; check cookie / `SESSION_SECRET` |
| `OPENAI_API_KEY environment variable not set` | Blank or missing key on Render | Step F — set key; do not leave empty string |
| LiteLLM `token_not_found_in_db` | OpenAI key used as proxy token, or wrong proxy | Step E — virtual key for that host |
| LiteLLM `Invalid model name` | `OPENAI_MODEL` not in proxy catalog (e.g. left at OpenAI default) | `GET /v1/models` and set a listed id |
| Empty / no PRs | No open PRs, or GitHub account cannot see the repo | Different repo or reconnect with access |
| LLM quota / credit errors | Billing or key scope | [Key permissions](#openai-api-key--scope-permissions-least-privilege) + provider dashboard |

---

## LLM models (current defaults)

This app only needs **chat completions** (plain text in → summary out). Recommended ids as of 2026 (OpenAI API):

| Setting | Recommended model id | Notes |
|---------|----------------------|--------|
| Default (demos / low cost) | `gpt-5-mini` | Fast, cheap; good default for this template |
| Balanced / production | `gpt-5.6-terra` | Strong quality vs cost for longer PR diffs |
| Highest quality | `gpt-5.6-sol` | Frontier reasoning; highest cost |
| Via LiteLLM / proxy | Whatever your proxy lists | e.g. `claude-haiku-4-5`, `claude-sonnet-4-5` — call `GET /v1/models` with your virtual key |

Examples:

| | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` |
|---|---|---|---|
| **OpenAI direct** | Project key (`sk-proj-...`) | *(leave empty / unset)* | `gpt-5-mini` |
| **OpenAI higher quality** | Same | *(leave empty / unset)* | `gpt-5.6-terra` or `gpt-5.6-sol` |
| **LiteLLM proxy** | LiteLLM **virtual key** (not a raw OpenAI key unless registered on the proxy) | `https://your-proxy.example.com/v1` | e.g. `claude-haiku-4-5` |
| **Azure / Ollama / other** | Key or token for that endpoint | Endpoint base URL (include `/v1` if required) | That endpoint’s model name |

**LiteLLM vs OpenAI:** if `OPENAI_BASE_URL` is set, the key is sent only to that host. Use a proxy virtual key + a model id from that proxy’s catalog. Do not mix an OpenAI `sk-proj-` key with a LiteLLM base URL unless the proxy is configured to accept it.

Model IDs change over time — confirm the latest names in the [OpenAI model docs](https://platform.openai.com/docs/models) (or `GET {OPENAI_BASE_URL}/models` on your proxy) before production.

---

## OpenAI API key — scope permissions (least privilege)

This sample calls **only** chat completions through the OpenAI SDK (`generateSummary` in `src/tasks.ts`). Scope the key so a leak cannot create assistants, train models, read files, or manage the org.

### What this app needs

| Capability | Permission | Why |
|------------|------------|-----|
| Model / chat inference (`model.request` or equivalent **Models** write) | **Write** | Single `chat.completions.create` call to summarize PRs |
| Everything else | **None** | Not used |

### What to leave at None (not required)

| Capability | Why you can disable it |
|------------|------------------------|
| Assistants | No Assistants API |
| Fine-tuning | No fine-tunes |
| Files / Vector stores | No uploads or RAG stores |
| Batch | No Batch API jobs |
| Images / Audio / Video | Text-only summaries |
| Threads / Responses extras beyond chat | Only chat completions path is used |
| Organization / project admin | Use a project key, not an owner key |

Dashboard labels shift over time. If summarize fails with a missing-scope / permission error, enable **Write** only on the model/inference row the UI surfaces — do not flip the key to “All”.

### How to create a restricted key

On [platform.openai.com](https://platform.openai.com):

1. Create (or reuse) a **Project** dedicated to this template (or demo env).
2. **API keys → Create** a **project secret key** for that project (prefer project keys over broad user keys).
3. Set permissions to **Restricted** (not **All**).
4. Grant **Write** only for model / chat inference (see table above).
5. Leave every other capability at **None**.
6. Optionally restrict the **project’s allowed models** to the ids in `OPENAI_MODEL` (for example only `gpt-5-mini` and `gpt-5.6-terra`) so the key cannot call expensive models you did not intend.
7. Set a **monthly budget / spend limit** and sensible rate limits on the project for demos.
8. Store the secret only in Render **Environment** or a local gitignored `.env` — never commit it, never paste it into the client.

### Proxies (LiteLLM, Azure, gateway)

If `OPENAI_BASE_URL` points at a proxy, `OPENAI_API_KEY` is the **proxy** credential:

- Create a **virtual key** (or equivalent) with the minimum model allowlist and spend limits the proxy supports.
- Prefer a key scoped to only the model ids you set in `OPENAI_MODEL`.
- Do not reuse a full-access OpenAI user key as a proxy token unless that is intentional and documented.

### Quick security checklist

- [ ] Restricted project key (not “All” permissions)
- [ ] Only model inference write enabled
- [ ] Model allowlist matches `OPENAI_MODEL`
- [ ] Project spend limit set
- [ ] Secret only in server env (Render / `.env`), not in the browser

---

## How it works

1. A browser visits `/` and receives a signed, HTTP-only session cookie.
2. The server mints an opaque identifier such as `usr_...` for that session.
3. `POST /api/auth` creates a GitHub auth link via Scalekit.
4. The browser opens the auth link in a **new tab**. The user completes GitHub OAuth there.
5. The original tab polls `GET /api/auth/status`, which queries Scalekit's API to check when the connected account becomes `ACTIVE`.
6. Once active, the original tab auto-reloads and shows a **GitHub connected** banner.
7. `POST /api/summarize` reads the identifier from the session and runs GitHub tool calls on behalf of that connected account.

The app also supports Scalekit's [custom user verification](https://docs.scalekit.com/agentkit/user-verification/) callback flow. When that mode is enabled in the dashboard, Scalekit redirects the OAuth tab to `/user/verify` after authorization completes, and the server calls `verifyConnectedAccountUser` before marking the session connected. Both detection paths (API polling and callback) work in parallel — whichever fires first wins.

## Web UI

The app serves a browser UI at `http://localhost:3000` in development or at your Render service URL in production.

The UI has two steps:

1. **Connect GitHub**. Click **Connect GitHub**. A new tab opens for the GitHub OAuth flow. The original tab waits and auto-reloads when the connection is active.
2. **Summarize pull requests**. Paste a GitHub repository URL or enter `owner/repo`, then generate summaries.

When the connection succeeds, the page shows a **GitHub connected** banner. There is no user ID field anywhere in the UI.

## HTTP API

### `POST /api/auth`

Starts the GitHub connection flow for the current browser session.

- No request body
- Returns `{ "authLink": "https://..." }`
- The browser opens `authLink` in a new tab for the user to complete OAuth

### `GET /api/auth/status`

Returns `{ "connected": true | false }` for the current session. The frontend polls this endpoint after opening the OAuth tab. It checks the in-memory session first, then queries the Scalekit API for the connected account's status.

### `GET /user/verify`

Optional callback for [custom user verification](https://docs.scalekit.com/agentkit/user-verification/) mode. When enabled in the Scalekit dashboard, Scalekit redirects here after OAuth with `auth_request_id` and `state`. The server validates the state, calls `verifyConnectedAccountUser`, and marks the session connected.

This callback is not required for the app to work — the `/api/auth/status` polling detects completion via the Scalekit API regardless of verification mode.

### `POST /api/summarize`

Summarizes the top open PRs for a repository using the GitHub account connected to the current session.

```bash
curl -X POST https://your-service.onrender.com/api/summarize \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_SIGNED_SESSION_COOKIE" \
  -d '{"repository":"https://github.com/octocat/Hello-World"}'
```

| Field | Description |
|---|---|
| `repository` | GitHub repository URL or `owner/repo` value |
| `owner` | Optional backward-compatible owner field |
| `repo` | Optional backward-compatible repo field |

If the session has not connected GitHub yet, the server returns `401`.

## Architecture

```text
Browser (original tab)                  Browser (new tab)
  │                                       │
  ▼ GET /                                 │
Express server                            │
  │ issues signed session cookie          │
  ▼ POST /api/auth                        │
Scalekit connected account + auth link    │
  │                                       │
  │  opens auth link ─────────────────►   ▼
  │                                     GitHub OAuth consent
  │                                       │
  │  polls GET /api/auth/status           ▼
  │  ◄─── Scalekit API: ACTIVE ──►  Scalekit verifies account
  │
  ▼ page auto-reloads
  │
  ▼ POST /api/summarize { repository }
Render tasks + Scalekit GitHub connector + LLM
```

## Included tasks

| Task | Purpose |
|---|---|
| `setupGitHubAuth` | Creates the GitHub authorization link for the current server-side identifier |
| `summarizePRs` | Orchestrates the PR summary flow for the current session |
| `fetchOpenPRs` | Lists open PRs through Scalekit's GitHub connector |
| `fetchPRDetails` | Fetches PR diffs and comments through the connector |
| `generateSummary` | Calls the LLM to produce plain-language summaries |

## Production notes

- The sample stores sessions in memory. Use Redis or a database-backed shared session store in production.
- The signed cookie detects tampering. The actual identifier stays server-side in the session store.
- When custom user verification is enabled, the `state` value is single-use and expires after 10 minutes.
- The app requires the connected GitHub token to have access to the target repository.
- Switch to **Custom user verification** in the Scalekit dashboard before going to production. See [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/).
- Scope the OpenAI project key as tightly as possible ([least privilege](#openai-api-key-least-privilege)).

## Resources

- [Scalekit AgentKit docs](https://docs.scalekit.com/agent-auth)
- [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/)
- [Render web services docs](https://docs.render.com/web-services)
- [OpenAI model docs](https://platform.openai.com/docs/models)
- [Managing OpenAI projects / API keys](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
