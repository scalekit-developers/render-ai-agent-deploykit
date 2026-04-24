# Multi-user GitHub PR summarizer agent

> 📖 **Cookbook:** [Build a multi-user GitHub PR summarizer agent](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)

This sample shows how to build a GitHub PR summarizer where each browser session connects its own GitHub account once, then uses that connected token for later tool calls. The server never asks the browser for a `userId`.

The app finds the five most-discussed open pull requests in a repository, fetches each PR's diff and comment thread through Scalekit's GitHub connector, then calls an LLM through any OpenAI-compatible API to produce a plain-language summary.

## Why this version is secure

The server mints an opaque identifier on the server side and stores it in its own session record. The browser only carries a signed, HTTP-only session cookie.

That design matters because the connected GitHub token is stored in Scalekit under the identifier you provide. If you let the browser choose that identifier, one user can point requests at another user's stored token. This sample avoids that cross-user impersonation bug by binding the identifier to the server-side session and completing the OAuth flow with Scalekit's user verification callback.

See [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/) for the full Scalekit flow.

## How it works

1. A browser visits `/` and receives a signed, HTTP-only session cookie.
2. The server mints an opaque identifier such as `usr_...` for that session.
3. `POST /api/auth` creates a GitHub auth link with a one-time `state` and a `userVerifyUrl`.
4. After GitHub OAuth completes, Scalekit redirects the browser to `/user/verify`.
5. The server validates `state`, calls `verifyConnectedAccountUser`, marks the session connected, and redirects back to `/`.
6. `POST /api/summarize` reads the identifier from the session and runs GitHub tool calls on behalf of that connected account.

## Web UI

The app serves a browser UI at `http://localhost:3000` in development or at your Render service URL in production.

The UI has two steps:

1. **Connect GitHub**. Click **Connect GitHub** and complete the OAuth flow in the same browser session.
2. **Summarize pull requests**. Paste a GitHub repository URL or enter `owner/repo`, then generate summaries.

When the callback succeeds, the page shows a **GitHub connected** banner. There is no user ID field anywhere in the UI.

## HTTP API

### `POST /api/auth`

Starts the GitHub connection flow for the current browser session.

- No request body
- Browser-driven flow
- Returns `{ "authLink": "https://..." }`

This endpoint is only useful from a browser session because the callback relies on the signed session cookie.

### `GET /user/verify`

Completes the connected-account verification flow after Scalekit redirects back with `auth_request_id` and `state`.

- Validates the one-time `state`
- Calls `verifyConnectedAccountUser`
- Marks the session as connected
- Redirects back to `/`

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

1. Open [app.scalekit.com](https://app.scalekit.com) and go to **Agent Auth > Connectors**
2. Add a **GitHub** connector
3. Finish the connector setup
4. Copy the generated connection name into `GITHUB_CONNECTION_NAME`

### 2. Enable custom user verification

This sample uses the secure connected-account verification flow from Scalekit's docs.

1. In the Scalekit Dashboard, go to **AgentKit > Settings > User verification** and set it to **Custom user verification**
2. Set `PUBLIC_BASE_URL` if you want to pin the callback origin explicitly
3. If `PUBLIC_BASE_URL` is unset, the app falls back to the incoming request origin
4. The app sends `${PUBLIC_BASE_URL}/user/verify` as `userVerifyUrl` when it creates the GitHub auth link when that variable is set

### 3. Configure local environment variables

```bash
cp .env.example .env
npm install
```

Fill in `.env` with your Scalekit and LLM settings.

Important variables:

- `SESSION_SECRET`: generate with `openssl rand -hex 32`
- `PUBLIC_BASE_URL`: optional override for the callback origin; set it to `http://localhost:3000` locally or your public Render URL in production if you want to pin the callback URL explicitly
- `GITHUB_CONNECTION_NAME`: copy from the Scalekit dashboard

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

- `LITELLM_API_KEY`
- `SCALEKIT_ENVIRONMENT_URL`
- `SCALEKIT_CLIENT_ID`
- `SCALEKIT_CLIENT_SECRET`
- `GITHUB_CONNECTION_NAME`
- `SESSION_SECRET`
- `PUBLIC_BASE_URL`

When `PUBLIC_BASE_URL` is set, use the exact public URL of the deployed service, for example `https://your-service.onrender.com`.

If `PUBLIC_BASE_URL` is omitted, the app falls back to the incoming request origin for the OAuth callback URL. When you deploy from the included `render.yaml`, Render auto-generates `SESSION_SECRET` for you.

## Architecture

```text
Browser
  │
  ▼ GET /
Express server
  │ issues signed HTTP-only session cookie
  ▼ POST /api/auth
Scalekit connected account + auth link
  │
  ▼ GET /user/verify?auth_request_id=...&state=...
Express server validates state and calls verifyConnectedAccountUser
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
- The `state` value is single-use and expires after 10 minutes.
- The app requires the connected GitHub token to have access to the target repository.

## Resources

- [Scalekit AgentKit docs](https://docs.scalekit.com/agent-auth)
- [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/)
- [Render web services docs](https://docs.render.com/web-services)
