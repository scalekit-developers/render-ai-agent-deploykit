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

## Quick start path (Scalekit → GitHub → env → Render)

Setup jumps between three products. Follow this order once end-to-end before debugging anything else.

```text
1. Scalekit  → create GitHub connector, copy connection name + Redirect URI
2. GitHub    → OAuth App callback URL = Scalekit Redirect URI (not your Render URL)
3. Scalekit  → set User verification mode (required)
4. Secrets   → fill .env locally and/or Render Environment
5. Render    → Deploy Blueprint / Deploy to Render button
6. Browser   → Connect GitHub → paste repo → Summarize PRs
```

### 1. Scalekit — GitHub connector

1. Open [app.scalekit.com](https://app.scalekit.com) → **AgentKit → Connectors**
2. Add a **GitHub** connector
3. Copy:
   - **Connection name** → you will set `GITHUB_CONNECTION_NAME`
   - **Redirect URI** shown on that connector (this is Scalekit’s OAuth callback, not your app URL)

### 2. GitHub — OAuth App callback

1. In GitHub → **Settings → Developer settings → OAuth Apps** (or your org’s OAuth App)
2. Set **Authorization callback URL** to the **Scalekit Redirect URI** from step 1
3. Do **not** point the callback at `https://your-service.onrender.com` or `http://localhost:3000` — GitHub must return to Scalekit, which then completes the connected-account flow

### 3. Scalekit — user verification (required)

Go to **AgentKit → Settings → User verification** and choose a mode **before** testing Connect GitHub.

| Mode | When to use | After OAuth |
|------|-------------|-------------|
| **Scalekit users only** | Development / testing | Scalekit activates the connected account. The app detects `ACTIVE` via polling. |
| **Custom user verification** | Production | Scalekit redirects to your app’s `/user/verify`. The server calls `verifyConnectedAccountUser`. Polling still works as a fallback. |

If you skip this step, the UI often sticks on **Waiting for GitHub authorization**.

Details: [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/).

### 4. Secrets — local `.env`

```bash
cp .env.example .env
npm install
```

| Variable | Where it comes from |
|----------|---------------------|
| `SCALEKIT_ENVIRONMENT_URL` | Scalekit → **Developers → API Credentials** |
| `SCALEKIT_CLIENT_ID` | Same |
| `SCALEKIT_CLIENT_SECRET` | Same |
| `GITHUB_CONNECTION_NAME` | Scalekit → **AgentKit → Connectors** (connection name). Optional; defaults to `github-qkHFhMip` for the sampleapps Render demo env |
| `OPENAI_API_KEY` | OpenAI project key (or OpenAI-compatible proxy token) — see [least privilege](#openai-api-key-least-privilege) |
| `OPENAI_MODEL` | Chat model id (default `gpt-5-mini`) |
| `OPENAI_BASE_URL` | Optional. Empty = OpenAI direct. For LiteLLM use the proxy base including `/v1` (e.g. `https://llm.example.com/v1`) |
| `SESSION_SECRET` | `openssl rand -hex 32` (Render auto-generates via `render.yaml`) |
| `PUBLIC_BASE_URL` | Optional. Auto-detected on Render; set only for custom domains / unusual proxies |
| `PORT` | Optional. Default `3000` |

### 5. Render — deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit)

Or push this repo and deploy with the included `render.yaml` Blueprint. Set the same secrets as above in the Render **Environment** panel (`SESSION_SECRET` is generated for you).

After deploy, re-check **User verification** in Scalekit (step 3) if the Connect GitHub flow never becomes active.

### 6. Use the app

1. Open the service URL (local `http://localhost:3000` or your Render URL)
2. Click **Connect GitHub** — OAuth opens in a **new tab**
3. Finish GitHub consent; the original tab reloads when the session is connected
4. Paste a repository URL or `owner/repo` → **Summarize PRs**

Public repos work with any connected account. Private repos require that the connected GitHub user has access.

### Common mistakes

| Symptom | Likely cause |
|---------|----------------|
| Stuck on “Waiting for GitHub authorization” | User verification mode not set in Scalekit |
| OAuth error / redirect mismatch | GitHub OAuth callback is your Render URL instead of Scalekit Redirect URI |
| `401` on summarize | GitHub never connected for this browser session |
| Empty / no PRs | Repo has no open PRs, or connected account cannot see the repo |
| LLM errors / credit messages | Invalid `OPENAI_API_KEY`, wrong `OPENAI_BASE_URL`, or model not allowed on the key/project |

### Run locally

```bash
npm run dev
```

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

## OpenAI API key (least privilege)

This sample calls **only** the chat completions API through the OpenAI SDK (`generateSummary` in `src/tasks.ts`). It does **not** need Assistants, Fine-tuning, Batch, Images, Audio, or org administration.

Recommended setup on [platform.openai.com](https://platform.openai.com):

1. Create (or reuse) a **Project** dedicated to this template.
2. Create a **project secret key** for that project (prefer a project key over a broad user key).
3. When creating/editing the key, set permissions to **Restricted** (not “All”).
4. Grant **Write** only where required for model inference / chat completions (endpoint labels vary slightly in the dashboard; if chat fails with a missing-scope error, enable the **Model** / **model.request** capability the UI surfaces).
5. Leave unused capabilities (Assistants, Fine-tuning, Files, Vector stores, etc.) at **None**.
6. Optionally restrict the **project’s allowed models** to the ids you set in `OPENAI_MODEL` (for example only `gpt-5-mini` and `gpt-5.6-terra`).
7. Prefer spend limits / rate limits on the project for demos.

If you set `OPENAI_BASE_URL` to a proxy (LiteLLM, Azure, gateway), the key you put in `OPENAI_API_KEY` is the **proxy** credential — apply least privilege on that system instead of (or in addition to) OpenAI’s dashboard.

Never commit real keys. Use Render Environment secrets or a local `.env` that stays gitignored.

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
