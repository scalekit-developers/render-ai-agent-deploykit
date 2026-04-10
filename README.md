# Render AI Agent Deploykit

An AI-powered workflow kit that lets team members trigger automated tasks — doc updates, fixes, customer support — directly from the Render Dashboard, no developer intervention required.

Built on [Render Workflows](https://render.com/docs/workflows) with an OpenAI-compatible client that routes through [Scalekit's LiteLLM proxy](https://llm.scalekit.cloud), so you can swap models without touching code.

## What it does

Team members can trigger multi-turn AI agent runs from the Render Dashboard or CLI. The agent handles requests by calling tools, reasoning over results, and returning a final response — all orchestrated as durable, retriable tasks.

The included example is a customer support agent. Swap in your own tools to handle doc updates, content fixes, data lookups, or any repeatable task you'd otherwise escalate to an engineer.

## Workflow structure

```
multiTurnConversation   ← trigger this with your input messages
  └─ agentTurn          ← one turn per message
       ├─ callLlmWithTools   ← LLM decides which tools to call
       ├─ executeTool        ← runs the chosen tool
       │    ├─ getOrderStatus
       │    ├─ processRefund
       │    └─ searchKnowledgeBase
       └─ callLlmWithTools   ← LLM synthesizes tool results into a response
```

Each box is an independent, retriable Render task. Failed steps retry automatically without re-running the whole conversation.

## For team members: triggering a run

Once deployed, you don't need to touch code. Go to your Workflow service in the [Render Dashboard](https://dashboard.render.com), select a task, and provide your input.

Or via the CLI:

```bash
render workflows tasks start multiTurnConversation \
  --input='["What is the status of order ORD-001?", "Can I get a refund?"]'
```

Each string in the array is one message in the conversation. The agent handles the rest.

## For developers: setup

### Prerequisites

- Node.js 18+
- [Render CLI](https://render.com/docs/cli) v2.11.0+ (`brew install render`)
- A Scalekit account with a LiteLLM API key

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `LITELLM_API_KEY` | Your Scalekit LiteLLM key (takes priority over `OPENAI_API_KEY`) |
| `LITELLM_BASE_URL` | Proxy URL — defaults to `https://llm.scalekit.cloud` |
| `LITELLM_MODEL` | Model to use — e.g. `claude-sonnet-4-6`, `claude-haiku-4-5` |
| `OPENAI_API_KEY` | Fallback if not using LiteLLM |
| `RENDER_API_KEY` | Required for cross-workflow task invocation |

### Available models

```
claude-haiku-4-5
claude-sonnet-4-6          ← recommended default
claude-haiku-4-5-20251001
claude-opus-4-6
```

### Run locally

```bash
npm install

# In one terminal — starts the local task server
render workflows dev -- npm run dev

# In another terminal — list registered tasks
render workflows tasks list --local

# Trigger a test run
render workflows tasks start multiTurnConversation \
  --local \
  --input='["What is the status of order ORD-001?"]'
```

## Deploy to Render

1. Push this repo to GitHub, GitLab, or Bitbucket
2. In the [Render Dashboard](https://dashboard.render.com), click **New > Workflow**
3. Link your repository
4. Set the following:

| Field | Value |
|-------|-------|
| **Build command** | `npm install && npm run build` |
| **Start command** | `node dist/main.js` |

5. Add your environment variables (see table above)
6. Click **Deploy Workflow**

Tasks appear in the Dashboard under your workflow service once the deploy succeeds.

## Adding your own tools

Tools live in `src/main.ts`. To add a new one:

1. Define a task function wrapped in `task()`:

```typescript
const myTool = task(
  { name: "myTool", retry },
  function myTool(input: string) {
    // your logic here
    return { success: true, result: "..." };
  }
);
```

2. Add it to the `tools` array (the JSON Schema definition the LLM sees)
3. Add a `case` for it in `executeTool`

That's it. The agent will automatically use the tool when relevant.

## Retry behavior

| Task | Retries | Notes |
|------|---------|-------|
| `getOrderStatus` | 3 (2s, exponential) | Safe to retry |
| `searchKnowledgeBase` | 3 (2s, exponential) | Safe to retry |
| `callLlmWithTools` | 3 (2s, exponential) | Safe to retry |
| `processRefund` | None | Non-idempotent — no retries |

## Related

- [Render Workflows docs](https://render.com/docs/workflows)
- [LiteLLM proxy docs](https://docs.litellm.ai/docs/proxy/user_keys)
- [Scalekit](https://scalekit.com)
