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
Browser
  │
  ▼ GET /
Express app on Render
  │ set signed HTTP-only session cookie
  ▼ POST /api/auth
Scalekit creates auth link for session-bound identifier
  │
  ▼ GET /user/verify
Express app validates state and calls verifyConnectedAccountUser
  │
  ▼ POST /api/summarize { owner, repo }
Scalekit GitHub connector fetches PR data with the connected user's token
```

## Required environment variables

- `PORT`
- `LITELLM_API_KEY`
- `LITELLM_BASE_URL`
- `LITELLM_MODEL`
- `SCALEKIT_ENVIRONMENT_URL`
- `SCALEKIT_CLIENT_ID`
- `SCALEKIT_CLIENT_SECRET`
- `GITHUB_CONNECTION_NAME`
- `SESSION_SECRET`
- `PUBLIC_BASE_URL`

Generate `SESSION_SECRET` with `openssl rand -hex 32`.

Set `PUBLIC_BASE_URL` to the public origin of the deployed service, for example `https://your-service.onrender.com`.

If you deploy from the included `render.yaml`, Render auto-generates `SESSION_SECRET`. You still need to supply `PUBLIC_BASE_URL`.

## Scalekit connector setup

Before using the deployed app:

1. Create a GitHub connector in **Agent Auth > Connectors**
2. In the Scalekit Dashboard, go to **AgentKit > Settings > User verification** and set it to **Custom user verification**
3. Set `PUBLIC_BASE_URL` to the exact origin where the app will run
4. The app sends `${PUBLIC_BASE_URL}/user/verify` as `userVerifyUrl` when it creates the GitHub auth link

## What the deployed service exposes

- `GET /`: HTML UI with **Connect GitHub** and repository summary form
- `POST /api/auth`: starts the GitHub OAuth flow for the current session
- `GET /user/verify`: completes connected-account verification after OAuth
- `POST /api/summarize`: summarizes PRs for the repository using the session's connected GitHub account

## Operational note

The sample stores session data in memory. That is acceptable for a single-instance demo. Use a shared store such as Redis or a database-backed session store in production.
