# Render PR Summarizer

A Render Workflow that finds the 5 most-discussed open pull requests in any GitHub repository and generates a plain-language summary for each one — written for a team lead or manager who wants a quick read on where things stand.

The agent reads each PR's code diff and comment thread via Scalekit's GitHub connector (OAuth token vault), then calls Claude through LiteLLM to produce the summary.

## How it works

1. Fetches all open PRs from the target repo via Scalekit's GitHub tool proxy
2. Ranks them by total comment count (issue comments + review comments)
3. For each of the top 5: fetches the raw diff and comment thread
4. Calls Claude (via LiteLLM) to write one paragraph per PR in plain language

## Prerequisites

Before running the workflow, the GitHub account you want to act as must be connected to Scalekit:

1. Go to your [Scalekit Dashboard](https://app.scalekit.com) → **Connections** → **GitHub**
2. Generate an Admin Portal link and share it with the user, or connect the account directly
3. Once connected, note the **identifier** you used — this is your `userId` when triggering the workflow

## Limitations

- Works with any repo the connected GitHub token has access to. Public repos work without any special token scopes. Private repos require a token with `repo` scope.
- Ranks by comment count (issue comments + review comments). PRs with no comments are still included if there are fewer than 5 total open PRs.

## Trigger via CLI

```bash
render workflows tasks start summarizePRs \
  --input='{"userId":"alice","owner":"octocat","repo":"Hello-World"}'
```

| Input field | Description |
|---|---|
| `userId` | Your Scalekit connected account identifier |
| `owner` | GitHub repo owner (org or username) |
| `repo` | GitHub repo name |

## Local development

```bash
cp .env.example .env
# Fill in your values in .env

npm install

# Terminal 1 — start the workflow server
render workflows dev -- npm run dev

# Terminal 2 — trigger the workflow
render workflows tasks start summarizePRs \
  --local \
  --input='{"userId":"alice","owner":"octocat","repo":"Hello-World"}'
```

## Wiring to any trigger

The `summarizePRs` task is a standard Render Workflow task. You can trigger it from any system — a webhook, a cron job, a Slack bot, a GitHub Action, etc.

Example: trigger from another service using the Render SDK:

```typescript
import { WorkflowsClient } from "@renderinc/sdk";

const client = new WorkflowsClient({ apiKey: process.env.RENDER_API_KEY });

await client.startTask("your-workflow-slug/summarizePRs", {
  userId: "alice",
  owner: "octocat",
  repo: "Hello-World",
});
```

You can also point a webhook endpoint directly at this — receive the event, extract the repo info, and call `startTask`.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `LITELLM_API_KEY` | Yes | LiteLLM proxy API key |
| `LITELLM_BASE_URL` | Yes | LiteLLM proxy base URL |
| `LITELLM_MODEL` | No | Defaults to `claude-haiku-4-5` |
| `SCALEKIT_ENVIRONMENT_URL` | Yes | Your Scalekit environment URL |
| `SCALEKIT_CLIENT_ID` | Yes | Scalekit app client ID |
| `SCALEKIT_CLIENT_SECRET` | Yes | Scalekit app client secret |
| `GITHUB_CONNECTION_NAME` | No | Scalekit GitHub connection name (default: `github-qkHFhMip`) |

## Deploy to Render

1. Push this repo to GitHub (or GitLab / Bitbucket)
2. In the [Render Dashboard](https://dashboard.render.com), click **New → Workflow**
3. Connect your repo
4. Set **Build command**: `npm install && npm run build`
5. Set **Start command**: `node dist/main.js`
6. Add the environment variables from the table above
7. Deploy — the `summarizePRs` task will appear in the Render Dashboard and can be triggered from there or via CLI
