# GitHub PR summarizer web service on Render

## Why deploy this sample on Render?

This sample runs as a Node web service with an HTML UI and a secure GitHub connection flow. Each browser session connects its own GitHub account once, then reuses that connected token for later PR summary requests.

Scalekit provides the GitHub connector, connected-account vault, and user verification flow. Render provides the hosting surface for the Express app and its task execution.

## What makes this deployment safe for multiple users

The browser never sends a `userId`.

Instead, the server:

- mints a random opaque identifier for each session
- stores that identifier in a server-side session record
- sends only a signed, HTTP-only cookie to the browser
- validates a one-time `state` during the OAuth callback
- calls `verifyConnectedAccountUser` before using the connected token

That prevents one browser session from pointing requests at another user's connected GitHub credentials.

## Runtime flow

```text
Browser (original tab)                  Browser (new tab)
  │                                       │
  ▼ GET /                                 │
Express app on Render                     │
  │ set signed session cookie             │
  ▼ POST /api/auth                        │
Scalekit creates auth link                │
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
Scalekit GitHub connector fetches PR data with connected user's token
```

## Required environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SCALEKIT_ENVIRONMENT_URL` | Yes | From Scalekit dashboard → Developers → API Credentials |
| `SCALEKIT_CLIENT_ID` | Yes | Same location |
| `SCALEKIT_CLIENT_SECRET` | Yes | Same location |
| `GITHUB_CONNECTION_NAME` | Yes | From AgentKit → Connectors |
| `OPENAI_API_KEY` | Yes | OpenAI key or proxy token |
| `OPENAI_BASE_URL` | No | Leave empty for OpenAI direct. Set to proxy URL for LiteLLM, Azure, etc. |
| `OPENAI_MODEL` | No | Default: `gpt-4.1-mini` |
| `SESSION_SECRET` | Auto | `render.yaml` auto-generates this. Or generate with `openssl rand -hex 32`. |
| `PUBLIC_BASE_URL` | No | Auto-detected from proxy headers. Only needed behind a custom domain. |

The app accepts any OpenAI-compatible API:

| | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` |
|---|---|---|---|
| **OpenAI direct** | your OpenAI key (`sk-...`) | *(leave empty)* | `gpt-4.1-mini` |
| **LiteLLM proxy** | your proxy token | proxy URL (e.g. `https://llm.example.com`) | any model the proxy serves (e.g. `claude-haiku-4-5`) |
| **Azure / Ollama / other** | your key or token | your endpoint URL | your model name |

## Scalekit setup

Before using the deployed app, complete these steps in the [Scalekit dashboard](https://app.scalekit.com). **Both steps are required — the app will not work without them.**

### GitHub connector

1. Go to **AgentKit > Connectors** and add a **GitHub** connector
2. Copy the **Redirect URI** shown by Scalekit for that connection
3. In GitHub's OAuth App settings, set **Authorization callback URL** to the Scalekit Redirect URI — **not** this Render app's URL
4. Copy the connector's connection name into the `GITHUB_CONNECTION_NAME` env var

### User verification

Go to **AgentKit > Settings > User verification** and choose a mode:

| Mode | When to use | What happens |
|------|-------------|--------------|
| **Scalekit users only** | Development / testing | Scalekit verifies internally. Account goes `ACTIVE` automatically after OAuth. |
| **Custom user verification** | Production | Scalekit redirects to your app's `/user/verify` callback. More secure. |

The app works in both modes. If you skip this step, the connected account may never activate and the app stays stuck on "Waiting for GitHub authorization."

See [User verification for connected accounts](https://docs.scalekit.com/agentkit/user-verification/) for details.

## What the deployed service exposes

- `GET /`: HTML UI with **Connect GitHub** and repository summary form
- `POST /api/auth`: generates the GitHub OAuth link for the current session
- `GET /api/auth/status`: returns `{ connected: true/false }` — polled by the frontend, queries Scalekit API
- `GET /user/verify`: optional callback for custom user verification mode
- `POST /api/summarize`: summarizes PRs for the repository using the session's connected GitHub account

## Operational note

The sample stores session data in memory. That is acceptable for a single-instance demo. Use a shared store such as Redis or a database-backed session store in production.
