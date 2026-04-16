# Deploy Scalekit Agent Kit onto Render Workflows

## Render PR Summarizer

> 📖 **Check out the full Step-by-Step Guide:** [Deploy GitHub PR Summarizer to Render](https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/)

A Render Workflow that finds the 5 most-discussed open pull requests in any GitHub repository and generates a plain-language summary for each one — written for a team lead or manager who wants a quick read on where things stand.

The agent reads each PR's code diff and comment thread via Scalekit's GitHub connector (OAuth token vault), then calls Claude through LiteLLM to produce the summary.

## Why this exists

As AI agents raise the velocity of code changes, the volume of open PRs on any team is only going up. This workflow gives every team member a quick briefing before a standup — what's in review, how much discussion each PR has, and whether it looks close to merging or still needs work.

Each team member runs the same workflow with their own `userId`. Scalekit's token vault handles per-user GitHub authentication — so the same deployed agent works for everyone on the team, each accessing GitHub as themselves.

## How it works

1. Fetches all open PRs from the target repo via Scalekit's GitHub tool proxy
2. Ranks them by total comment count (issue comments + review comments)
3. For each of the top 5: fetches the raw diff and comment thread (in parallel)
4. Calls Claude (via LiteLLM) to write one paragraph per PR in plain language

## Web UI

Once deployed (or running locally), the service exposes a web interface at its root URL (`http://localhost:3000` in development, or your Render service URL in production).

The UI has two sections:

1. **Connect GitHub** — enter a user ID to generate an OAuth authorization link. Open the link in a browser to grant GitHub access. Run once per user.
2. **Summarize Pull Requests** — enter a user ID, GitHub owner, and repo name. The agent fetches the top 5 most-discussed open PRs and generates AI summaries (takes up to 2 minutes).

The Render Workflow tasks (`setupGitHubAuth`, `summarizePRs`) still work via CLI and Dashboard as before — the web UI is an additional trigger.

## Setup

### 1. Configure the Scalekit GitHub connector

This is a one-time setup for your Scalekit environment. It creates the GitHub OAuth app that authenticates your team's GitHub accounts to the agent.

1. Go to [app.scalekit.com](https://app.scalekit.com) → **Agent Auth** → **Connectors**
2. Add a new connector and select **GitHub**
3. Follow the setup steps — Scalekit creates and manages the GitHub OAuth app for you
4. Note the **connection name** assigned (e.g. `github-qkHFhMip`) — set this as `GITHUB_CONNECTION_NAME` in your environment

### 2. Connect each user's GitHub account

Each team member needs to authorize the agent to act on their behalf. Run once per user:

```bash
render workflows tasks start setupGitHubAuth --local --input='["your-user-id"]'
```

This prints an `authLink`. Open it in your browser and authorize GitHub access. Scalekit stores the token in its vault — no callback server needed. Once authorized, that `userId` can be passed to `summarizePRs` to act as that user.

Alternatively, connect via the Scalekit Admin Portal: **Dashboard → Agent Auth → Generate portal link** and share it with the user.

## Trigger via CLI

**Locally (during development):**

```bash
render workflows tasks start summarizePRs \
  --local \
  --input='[{"userId":"alice","owner":"octocat","repo":"Hello-World"}]'
```

**Against the deployed workflow** (drop `--local`, prefix with your workflow slug):

```bash
render workflows tasks start <your-workflow-slug>/summarizePRs \
  --input='[{"userId":"alice","owner":"octocat","repo":"Hello-World"}]'
```

The task slug must be in the form `workflow-slug/task-name`. Your workflow slug is the service name shown in the Render Dashboard (e.g. `render-ai-agent-deploykit-workflow/summarizePRs`). You can also trigger tasks directly from the **Render Dashboard → your workflow service → Tasks**.

> Note: the input must be a JSON array (`[{...}]`), not a bare object.

| Input field | Description |
|---|---|
| `userId` | The user's Scalekit connected account identifier (set during `setupGitHubAuth`) |
| `owner` | GitHub repo owner (org or username) |
| `repo` | GitHub repo name |

## Limitations

- Works with any repo the connected GitHub token has access to. Public repos work without any special token scopes. Private repos require a token with `repo` scope.
- Ranks by comment count (issue comments + review comments). PRs with no comments are still included if there are fewer than 5 total open PRs.
- Diffs are truncated to 3000 characters per PR to keep LLM context manageable.

## Local development

```bash
cp .env.example .env
# Fill in your values in .env

npm install      # or: pnpm install
```

**Terminal 1 — start the workflow server + web UI**

```bash
render workflows dev -- npm run dev
# or with pnpm:
render workflows dev -- pnpm dev
```

Open `http://localhost:3000` in your browser to use the web UI.

**Terminal 2 — connect GitHub (once per user, or use the web UI)**

```bash
render workflows tasks start setupGitHubAuth --local --input='["your-user-id"]'
```

Open the printed `authLink` in your browser to authorize GitHub access.

**Terminal 2 — run the summarizer**

```bash
render workflows tasks start summarizePRs \
  --local \
  --input='[{"userId":"your-user-id","owner":"octocat","repo":"Hello-World"}]'
```

**Other useful Render CLI commands**

```bash
# List all available tasks (locally)
render workflows tasks list --local

# List all available tasks (deployed)
render workflows tasks list
```

> The CLI does not have a `get` subcommand — to check the status or output of a running task, open the **Render Dashboard → your workflow service → Task runs**.

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

## Wiring to any trigger

The `summarizePRs` task is a standard Render Workflow task. You can trigger it from any system — a webhook, a cron job, a Slack bot, a GitHub Action, etc.

Example: trigger from another service using the Render SDK:

```typescript
import { WorkflowsClient } from "@renderinc/sdk";

const client = new WorkflowsClient({ apiKey: process.env.RENDER_API_KEY });

await client.startTask("<your-workflow-slug>/summarizePRs", {
  userId: "alice",
  owner: "octocat",
  repo: "Hello-World",
});
```

A common pattern: wire this to a Slack slash command or a standup bot — each team member passes their `userId` and gets back a summary of the repo's most active PRs.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Web server port (default: `3000`) |
| `LITELLM_API_KEY` | Yes | LiteLLM proxy API key (also accepted as `OPENAI_API_KEY`) |
| `LITELLM_BASE_URL` | Yes | LiteLLM proxy base URL |
| `LITELLM_MODEL` | No | Defaults to `claude-haiku-4-5` |
| `SCALEKIT_ENVIRONMENT_URL` | Yes | Your Scalekit environment URL |
| `SCALEKIT_CLIENT_ID` | Yes | Scalekit app client ID |
| `SCALEKIT_CLIENT_SECRET` | Yes | Scalekit app client secret |
| `GITHUB_CONNECTION_NAME` | No | Scalekit GitHub connection name from the connector setup (default: `github-qkHFhMip`) |

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/saif-at-scalekit/render-ai-agent-deploykit)

Click the button above. Render reads `render.yaml` from the repo and prompts you to fill in the required environment variables (see the table above). The `summarizePRs` and `setupGitHubAuth` tasks will appear in the Render Dashboard once the deploy completes.
