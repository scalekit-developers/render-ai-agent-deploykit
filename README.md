# Multi-User GitHub PR Summarizer Agent

> 📖 **Step-by-step guide:** [Build a multi-user GitHub PR summarizer agent](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)

A GitHub PR summarizer agent where every team member connects their own GitHub account once — Scalekit's token vault handles per-user OAuth so the same deployed service works for the whole team.

The agent finds the five most-discussed open pull requests in any GitHub repository, reads each PR's diff and comment thread via Scalekit's GitHub connector, then calls an LLM through any OpenAI-compatible API to produce a plain-language summary for each one.

## Why this exists

As AI agents raise the velocity of code changes, the volume of open PRs on any team is only going up. This agent gives every team member a quick briefing before a standup — what's in review, how much discussion each PR has, and whether it looks close to merging or still needs work.

**What makes it multi-user:** any team member can connect their own GitHub account with one step. Scalekit's token vault stores their OAuth token and injects it automatically at runtime. The same deployed service works for everyone on the team — each person acting as themselves in GitHub. No shared API keys, no callback servers, no per-user infrastructure.

Scalekit also provides the GitHub connector itself. Rather than calling the GitHub API directly and managing auth headers and response shapes yourself, the agent calls Scalekit's pre-built GitHub tools by name (`github_pull_requests_list`). The connector handles token injection, normalizes responses, and exposes GitHub as clean callable tools.

## How it works

1. Fetches all open PRs from the target repo via Scalekit's GitHub tool proxy
2. Ranks them by total comment count (issue comments + review comments)
3. For each of the top 5: fetches the raw diff and comment thread (in parallel)
4. Calls an LLM via any OpenAI-compatible API to write one paragraph per PR in plain language

## Web UI

Once deployed (or running locally), the service exposes a web interface at its root URL (`http://localhost:3000` in development, or your Render service URL in production).

The UI has two steps:

1. **Connect GitHub** — enter a user ID to generate an OAuth authorization link. Open the link in a browser to grant GitHub access. Run once per user.
2. **Summarize Pull Requests** — enter a user ID, GitHub owner, and repo name. The agent fetches the top 5 most-discussed open PRs and generates AI summaries (takes up to 2 minutes).

## HTTP API

The service also accepts direct HTTP calls:

```bash
# Connect a user's GitHub account (run once per user)
curl -X POST https://your-service.onrender.com/api/auth \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice"}'
# → { "userId": "alice", "authLink": "https://..." }

# Open the authLink in a browser to authorize GitHub access.

# Summarize PRs
curl -X POST https://your-service.onrender.com/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","owner":"octocat","repo":"Hello-World"}'
# → { "repository": "...", "prsAnalyzed": [...], "summary": "..." }
```

| Field | Description |
|---|---|
| `userId` | The user's identifier — must match the one used during `setupGitHubAuth` |
| `owner` | GitHub repo owner (org or username) |
| `repo` | GitHub repo name |

## Setup

### 1. Configure the Scalekit GitHub connector

One-time setup for your Scalekit environment. It creates the GitHub OAuth app that authenticates your team's GitHub accounts to the agent.

1. Go to [app.scalekit.com](https://app.scalekit.com) → **Agent Auth** → **Connectors**
2. Add a new connector and select **GitHub**
3. Follow the setup steps — Scalekit creates and manages the GitHub OAuth app for you
4. Note the **connection name** assigned (e.g. `github-qkHFhMip`) — set this as `GITHUB_CONNECTION_NAME` in your environment

### 2. Connect each user's GitHub account

Each team member needs to authorize the agent to act on their behalf. Use the web UI (Step 1 form), or via API:

```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"userId":"your-user-id"}'
```

Open the returned `authLink` in your browser and authorize GitHub access. Scalekit stores the token in its vault — no callback server needed. Once authorized, that `userId` can be passed to `/api/summarize`.

Alternatively, use the Scalekit Admin Portal: **Dashboard → Agent Auth → Generate portal link** and share it with the user.

## Local development

```bash
cp .env.example .env
# Fill in your values in .env

npm install      # or: pnpm install
```

**Start the server**

```bash
npm run dev
```

Open `http://localhost:3000` to use the web UI.

**Other useful commands**

```bash
# Build for production
npm run build

# Start the compiled server
npm start
```

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit)

Click the button above. Render reads `render.yaml` from the repo (a web service) and prompts you to fill in the required environment variables. Once deployed, your team members open the service URL to connect their GitHub accounts and generate summaries.

## Architecture

```
Browser / HTTP client
        │
        ▼ POST /api/summarize (userId, owner, repo)
┌───────────────────────────────────┐
│         PR Summarizer Service      │
│  (Render web service — Express)   │
│                                   │
│  ┌─────────────────────────────┐  │
│  │   fetchOpenPRs task         │──┼──► Scalekit AgentKit ──► GitHub API
│  └─────────────────────────────┘  │     (OAuth vault +
│  ┌─────────────────────────────┐  │      GitHub connector)
│  │  fetchPRDetails task        │──┼──► GitHub API (diff + comments)
│  │   (runs in parallel)        │  │
│  └─────────────────────────────┘  │
│  ┌─────────────────────────────┐  │
│  │  generateSummary task       │──┼──► any OpenAI-compatible API
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
        │
        ▼ { repository, prsAnalyzed, summary }
```

## What's included

| Service | Type | Purpose |
|---|---|---|
| render-pr-summarizer | Web service | HTTP server + agent tasks for PR fetching, parallel detail retrieval, and LLM summarization |

### Agent tasks

| Task | Purpose |
|---|---|
| `setupGitHubAuth` | One-time per-user: generates GitHub OAuth authorization link via Scalekit AgentKit |
| `summarizePRs` | Root orchestrator: accepts `userId`, `owner`, `repo` and returns summary |
| `fetchOpenPRs` | Fetches open PRs via Scalekit GitHub connector, returns top 5 by comment count |
| `fetchPRDetails` | Fetches raw diff and comment thread for a single PR (runs in parallel) |
| `generateSummary` | Calls LLM to produce one plain-language paragraph per PR |

## Limitations

- Works with any repo the connected GitHub token has access to. Public repos work without any special token scopes. Private repos require a token with `repo` scope.
- Ranks by comment count (issue comments + review comments). PRs with no comments are still included if there are fewer than 5 total open PRs.
- Diffs are truncated to 3000 characters per PR to keep LLM context manageable.

## LLM configuration

The agent uses the `openai` npm package with a configurable `baseURL`, so it works with any OpenAI-compatible API:

| Provider | `LITELLM_BASE_URL` | `LITELLM_MODEL` |
|---|---|---|
| OpenAI directly | _(omit — defaults to OpenAI)_ | `gpt-4o`, `gpt-4o-mini`, … |
| LiteLLM proxy | your LiteLLM base URL | any model your proxy supports |
| Azure OpenAI | your Azure endpoint | `gpt-4o`, … |
| Ollama (local) | `http://localhost:11434/v1` | `llama3`, `mistral`, … |

The env vars are named `LITELLM_*` by convention, but they map directly to the `openai` SDK's `apiKey` and `baseURL` options — no LiteLLM-specific code is involved.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Web server port (default: `3000`) |
| `LITELLM_API_KEY` | Yes | API key for your LLM provider (also accepted as `OPENAI_API_KEY`) |
| `LITELLM_BASE_URL` | No | Base URL of your LLM endpoint; omit to use OpenAI directly |
| `LITELLM_MODEL` | No | Model name passed to the API (default: `claude-haiku-4-5`) |
| `SCALEKIT_ENVIRONMENT_URL` | Yes | Your Scalekit environment URL |
| `SCALEKIT_CLIENT_ID` | Yes | Scalekit app client ID |
| `SCALEKIT_CLIENT_SECRET` | Yes | Scalekit app client secret |
| `GITHUB_CONNECTION_NAME` | No | Scalekit GitHub connection name (default: `github-qkHFhMip`) |

## Wiring to any trigger

Call `POST /api/summarize` from any system — a Slack slash command handler, a cron job, a GitHub Action, or another service:

```typescript
const res = await fetch("https://your-service.onrender.com/api/summarize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "alice", owner: "octocat", repo: "Hello-World" }),
});
const { summary } = await res.json();
```

A common pattern: wire this to a Slack slash command so each team member passes their `userId` and gets back a summary of the repo's most active PRs.

## Sample output

```json
{
  "repository": "octocat/Hello-World",
  "prsAnalyzed": [
    "#42: Refactor authentication middleware",
    "#38: Add rate limiting to public endpoints",
    "#35: Update dependencies",
    "#31: Fix memory leak in background worker",
    "#28: Improve error messages"
  ],
  "summary": "**PR #42 — Refactor authentication middleware**\nThis change restructures how the app handles user login and session management. It has generated significant discussion with 14 review comments, suggesting the team has been actively working through the design. The back-and-forth looks mostly resolved, so this one appears close to ready.\n\n**PR #38 — Add rate limiting to public endpoints**\nThis pull request introduces guardrails to prevent API abuse on the public-facing routes. There are 9 comments, mostly around configuration choices for the limits. It still seems to have a few open questions that need resolution before merging."
}
```

## Resources

- [Scalekit AgentKit docs](https://docs.scalekit.com/agent-auth)
- [Step-by-step guide (cookbook)](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)
- [Render web services docs](https://docs.render.com/web-services)
