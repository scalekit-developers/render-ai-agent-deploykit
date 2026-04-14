# GitHub PR Summarizer with Render Workflows | Render

## Why deploy a PR summarizer workflow on Render?

A PR summarizer workflow fetches the most-discussed open pull requests from any GitHub repository and produces a plain-language briefing for each one — ranked by review activity, written for managers and team leads who want a quick read before standup.

**Scalekit is what makes this agent work for everyone, not just you.**

Most GitHub agents are built for a single token — yours. Scalekit AgentKit turns this into a multi-user agent: any team member, or anyone on the internet, can connect their own GitHub account with one command. Scalekit vaults their OAuth token and injects it automatically at runtime. The deployed workflow is shared; the GitHub credentials are always personal. No shared API keys, no callback servers, no per-user infrastructure.

Scalekit also provides the GitHub connector itself. Rather than calling the GitHub API directly and handling auth headers, response shapes, and pagination yourself, the workflow calls Scalekit's pre-built GitHub tools by name (`github_pull_requests_list`). The connector handles token injection, normalizes responses into agent-ready formats, and exposes GitHub as clean, callable tools. Your agent code stays simple.

Render Workflows handles the orchestration layer — parallel task execution, retries, and execution state. Configure environment variables and deploy.

## Architecture

```
CLI / Render Dashboard
        │
        ▼ trigger summarizePRs(userId, owner, repo)
┌───────────────────────────────┐
│     Render Workflow Worker     │
│                               │
│  ┌─────────────────────────┐  │
│  │   fetchOpenPRs task     │──┼──► Scalekit AgentKit ──► GitHub API
│  └─────────────────────────┘  │     (OAuth vault +
│  ┌─────────────────────────┐  │      GitHub connector)
│  │  fetchPRDetails task    │──┼──► GitHub API (diff + comments)
│  │   (runs in parallel)    │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │  generateSummary task   │──┼──► LiteLLM ──► Claude Haiku
│  └─────────────────────────┘  │
└───────────────────────────────┘
        │
        ▼ { repository, prsAnalyzed, summary }
```

## What you can build

After deploying, you'll have a working AI agent that fetches the five most-discussed open pull requests from any GitHub repository and writes a plain-language paragraph for each one — covering what the change does, how much review it has received, and whether it looks close to merging. Each team member runs the workflow with their own `userId`; Scalekit's AgentKit injects their personal GitHub OAuth token automatically, so the same deployed agent works for the whole team — or anyone outside it — without sharing credentials.

## Key features

- **Scalekit AgentKit — any user, zero OAuth infrastructure**: Any person can connect their GitHub account by running `setupGitHubAuth` once. Scalekit vaults their OAuth token and injects it at runtime on every subsequent call. The same deployed workflow serves your whole team, external contributors, or anyone on the internet — each acting as themselves in GitHub. No shared credentials, no callback server, no per-user code.

- **Scalekit GitHub Connector — tools your agent calls by name**: GitHub access goes through Scalekit's pre-built connector, not raw API calls. The connector exposes GitHub operations as named tools (`github_pull_requests_list`), handles token injection automatically, and normalizes responses into agent-ready shapes. Your workflow calls a tool name and gets clean data back — the connector handles auth, headers, and response parsing.

- **Render Workflows orchestration**: `fetchPRDetails` runs in parallel across the top 5 PRs using `Promise.all` wrapped in Render Workflow tasks, with automatic retries (3 attempts, 1 s backoff) on each step.

- **LLM summarization via LiteLLM proxy**: Calls Claude through a LiteLLM-compatible endpoint. Swap models by changing `LITELLM_MODEL` — no code changes needed.

- **Blueprint Infrastructure-as-Code**: `render.yaml` defines the workflow worker with all required environment variables for one-click deployment.

## Use cases

- Engineering manager gets a daily PR briefing before standup without opening GitHub
- Developer advocate demos per-user OAuth token vaulting for AI agents
- Team lead monitors PR activity across multiple repos with a single CLI command
- Platform engineer builds an internal tool that routes AI agent calls through individual team member credentials

## What's included

| Service | Type | Purpose |
|---|---|---|
| render-pr-summarizer | Workflow Worker | Orchestrates PR fetching, parallel detail retrieval, and LLM summarization |

### Workflow tasks

| Task | Purpose |
|---|---|
| `setupGitHubAuth` | One-time per-user: generates GitHub OAuth authorization link via Scalekit AgentKit |
| `summarizePRs` | Root orchestrator: accepts `userId`, `owner`, `repo` and returns summary |
| `fetchOpenPRs` | Fetches open PRs via Scalekit GitHub connector, returns top 5 by comment count |
| `fetchPRDetails` | Fetches raw diff and comment thread for a single PR (runs in parallel) |
| `generateSummary` | Calls LLM to produce one plain-language paragraph per PR |

## Next steps

1. **Connect each user's GitHub account** — Run `render workflows tasks start setupGitHubAuth --local --input='["your-user-id"]'`, open the printed `authLink` in your browser, and authorize GitHub access. Scalekit stores the token; no callback server needed.

2. **Trigger your first summary** — Run `render workflows tasks start summarizePRs --local --input='[{"userId":"your-user-id","owner":"octocat","repo":"Hello-World"}]'`. You should see the top 5 open PRs ranked by discussion volume and a plain-language paragraph for each one.

3. **Deploy to Render and run against the live workflow** — After deploying, drop `--local` and prefix the task name with your workflow slug: `render workflows tasks start <your-workflow-slug>/summarizePRs --input='[{...}]'`. Your workflow slug is the service name shown in the Render Dashboard.

## Resources

- [Render Workflows official docs](https://docs.render.com/workflows)
- [Scalekit AgentKit docs](https://docs.scalekit.com/agent-auth)
- [Step-by-step deployment guide (cookbook)](https://cookbook-render-pr-summarizer--scalekit-starlight.netlify.app/cookbooks/render-github-pr-summarizer/)
