# Multi-user GitHub PR summarizer agent

> 📖 **Cookbook:** [Build a multi-user GitHub PR summarizer agent](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)

This sample shows how to build a GitHub PR summarizer where each browser session connects its own GitHub account once, then uses that connected token for later tool calls. The server never asks the browser for a `userId`.

The app finds the five most-discussed open pull requests in a repository, fetches each PR's diff and comment thread through Scalekit's GitHub connector, then calls OpenAI to produce a plain-language summary. You can also point the OpenAI SDK at an OpenAI-compatible endpoint by setting `OPENAI_BASE_URL`.

## Why this version is secure

The server mints an opaque identifier on the server side and stores it in its own session record. The browser only carries a signed, HTTP-only session cookie.

That design matters because the connected GitHub token is stored in Scalekit under the identifier you provide. If you let the browser choose that identifier, one user can point requests at another user's stored token. This sample avoids that cross-user impersonation bug by binding the identifier to the server-side session and completing the OAuth flow with Scalekit's user verification callback.

See [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/) for the full Scalekit flow.

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

## Setup

### 1. Configure the Scalekit GitHub connector

1. Open [app.scalekit.com](https://app.scalekit.com) and go to **AgentKit > Connectors**
2. Add a **GitHub** connector
3. Copy the **Redirect URI** shown by Scalekit for this GitHub connection
4. In GitHub's OAuth App settings, set **Authorization callback URL** to that Scalekit Redirect URI — **not** your Render app's URL
5. Finish the connector setup
6. Copy the generated connection name into `GITHUB_CONNECTION_NAME`

### 2. Configure user verification (required)

Scalekit's user verification setting controls what happens after a user completes GitHub OAuth. **You must choose a mode in the dashboard before the app will work end-to-end.** Go to **AgentKit > Settings > User verification** in the [Scalekit dashboard](https://app.scalekit.com).

| Mode | When to use | What happens after OAuth |
|------|-------------|--------------------------|
| **Scalekit users only** | Development and testing | Scalekit verifies the user internally. The connected account goes `ACTIVE` automatically. The app detects this by polling the Scalekit API. |
| **Custom user verification** | Production | Scalekit redirects the browser to your app's `/user/verify` callback. The server calls `verifyConnectedAccountUser` to activate the account. The app also polls the Scalekit API as a fallback. |

The app works in **both modes** without code changes. If you skip this step entirely, the connected account may never reach `ACTIVE` status and the app will stay stuck on "Waiting for GitHub authorization."

For the custom verification flow details, see [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/).

### 3. Configure local environment variables

```bash
cp .env.example .env
npm install
```

Fill in `.env` with your Scalekit and LLM settings.

Important variables:

- `SESSION_SECRET`: generate with `openssl rand -hex 32`
- `GITHUB_CONNECTION_NAME`: copy from the Scalekit dashboard
- `PUBLIC_BASE_URL`: **optional** — the app auto-detects its public URL from proxy headers on Render. Only set this if you need to pin the callback origin explicitly (e.g. behind a custom domain or an unusual reverse proxy)

**LLM configuration** — the app accepts any OpenAI-compatible API. Pick the row that matches your setup:

| | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` |
|---|---|---|---|
| **OpenAI direct** | your OpenAI key (`sk-...`) | *(leave empty)* | `gpt-4.1-mini` |
| **LiteLLM proxy** | your proxy token | proxy URL (e.g. `https://llm.example.com`) | any model the proxy serves (e.g. `claude-haiku-4-5`) |
| **Azure / Ollama / other** | your key or token | your endpoint URL | your model name |

Leave `OPENAI_BASE_URL` empty to reach OpenAI directly. Set it to route all LLM calls through a proxy using your proxy token as the API key. The `OPENAI_MODEL` default is `gpt-4.1-mini`.

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`, click **Connect GitHub**, finish OAuth, then paste a GitHub repository URL or enter `owner/repo`.

After the callback succeeds, the page shows a **GitHub connected** banner and the Step 1 button changes to **Reconnect GitHub**.

Public repositories work with any connected GitHub account. Private repositories only work if the connected account has access.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit)

Render reads `render.yaml` and creates a Node web service. Set the required secrets in the Render dashboard:

| Variable | Required | Notes |
|----------|----------|-------|
| `SCALEKIT_ENVIRONMENT_URL` | Yes | From Scalekit dashboard → Developers → API Credentials |
| `SCALEKIT_CLIENT_ID` | Yes | Same location |
| `SCALEKIT_CLIENT_SECRET` | Yes | Same location |
| `GITHUB_CONNECTION_NAME` | Yes | From AgentKit → Connectors |
| `OPENAI_API_KEY` | Yes | OpenAI key or proxy token |
| `SESSION_SECRET` | Auto | `render.yaml` auto-generates this |
| `PUBLIC_BASE_URL` | No | Auto-detected from proxy headers. Only set if using a custom domain. |

After deploying, configure user verification in the Scalekit dashboard (see [step 2](#2-configure-user-verification-required) above). The app will not complete the GitHub connection flow without this.

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

## Resources

- [Scalekit AgentKit docs](https://docs.scalekit.com/agent-auth)
- [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/)
- [Render web services docs](https://docs.render.com/web-services)
