import "dotenv/config";
import { task } from "@renderinc/sdk/workflows";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { githubTool, linearTool, getAuthLink } from "./scalekit.js";

const retry = {
  maxRetries: 3,
  waitDurationMs: 2000,
  backoffScaling: 2.0,
};

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LITELLM_API_KEY or OPENAI_API_KEY environment variable not set. " +
      "Please set it in your Render environment variables.",
    );
  }
  const options: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  if (process.env.LITELLM_BASE_URL) {
    options.baseURL = process.env.LITELLM_BASE_URL;
  }
  return new OpenAI(options);
}

// ---- Tool Functions ----

const getOrderStatus = task(
  { name: "getOrderStatus", retry },
  function getOrderStatus(orderId: string) {
    console.log(`[TOOL] Looking up order status for: ${orderId}`);

    const mockOrders: { [key: string]: { status: string; tracking: string | null; eta: string } } = {
      "ORD-001": { status: "shipped", tracking: "1Z999AA1234567890", eta: "2024-10-15" },
      "ORD-002": { status: "processing", tracking: null, eta: "2024-10-12" },
      "ORD-003": { status: "delivered", tracking: "1Z999AA9876543210", eta: "2024-10-08" },
    };

    if (orderId in mockOrders) {
      const order = mockOrders[orderId];
      console.log(`[TOOL] Order ${orderId} found: ${order.status}`);
      return { success: true, order_id: orderId, ...order };
    }

    console.warn(`[TOOL] Order ${orderId} not found`);
    return { success: false, order_id: orderId, error: "Order not found" };
  },
);

// No retry: processing a refund is non-idempotent
const processRefund = task(
  { name: "processRefund" },
  function processRefund(orderId: string, reason: string) {
    console.log(`[TOOL] Processing refund for order: ${orderId}`);
    console.log(`[TOOL] Refund reason: ${reason}`);

    const refundId = `REF-${orderId}-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}`;

    const result = {
      success: true,
      refund_id: refundId,
      order_id: orderId,
      reason,
      amount: 99.99,
      processed_at: new Date().toISOString(),
    };

    console.log(`[TOOL] Refund processed: ${refundId}`);
    return result;
  },
);

const searchKnowledgeBase = task(
  { name: "searchKnowledgeBase", retry },
  function searchKnowledgeBase(query: string) {
    console.log(`[TOOL] Searching knowledge base: ${query}`);

    const knowledge: { [key: string]: { title: string; content: string } } = {
      shipping: {
        title: "Shipping Policy",
        content:
          "We offer free shipping on orders over $50. Standard shipping takes 3-5 business days. Express shipping is available for $15 and takes 1-2 business days.",
      },
      returns: {
        title: "Return Policy",
        content:
          "We accept returns within 30 days of purchase. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.",
      },
      warranty: {
        title: "Warranty Information",
        content:
          "All products come with a 1-year manufacturer warranty. Extended warranties are available for purchase.",
      },
    };

    const queryLower = query.toLowerCase();
    const matches = Object.entries(knowledge)
      .filter(
        ([key, article]) =>
          queryLower.includes(key) ||
          queryLower.split(" ").some((word) => article.content.toLowerCase().includes(word)),
      )
      .map(([, article]) => article);

    console.log(`[TOOL] Found ${matches.length} knowledge base articles`);
    return { success: true, query, results: matches, count: matches.length };
  },
);

// ---- Agent Tasks ----

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Look up the status of a customer order by order ID",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "The order ID (e.g., ORD-001)" },
        },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_refund",
      description: "Process a refund for an order",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "The order ID to refund" },
          reason: { type: "string", description: "Reason for the refund" },
        },
        required: ["order_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the knowledge base for help articles and information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

const callLlmWithTools = task(
  { name: "callLlmWithTools", retry },
  async function callLlmWithTools(
    messages: ChatCompletionMessageParam[],
    toolDefs: ChatCompletionTool[],
    model: string = process.env.LITELLM_MODEL ?? "gpt-4",
  ) {
    console.log(`[AGENT] Calling ${model} with ${toolDefs.length} tools available`);

    const client = createOpenAIClient();

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: toolDefs,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    const result: {
      content: string | null;
      tool_calls: { id: string; type: string; function: { name: string; arguments: string } }[];
    } = { content: message.content, tool_calls: [] };

    if (message.tool_calls) {
      result.tool_calls = message.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
      console.log(`[AGENT] Model requested ${result.tool_calls.length} tool calls`);
    }

    return result;
  },
);

const executeTool = task(
  { name: "executeTool", retry },
  async function executeTool(toolName: string, args: { [key: string]: string }) {
    console.log(`[AGENT] Executing tool: ${toolName}`);

    try {
      switch (toolName) {
        case "get_order_status":
          return await getOrderStatus(args.order_id);
        case "process_refund":
          return await processRefund(args.order_id, args.reason);
        case "search_knowledge_base":
          return await searchKnowledgeBase(args.query);
        default:
          console.error(`[AGENT] Unknown tool: ${toolName}`);
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`[AGENT] Tool execution failed: ${error}`);
      return { error: String(error) };
    }
  },
);

const agentTurn = task(
  { name: "agentTurn", retry },
  async function agentTurn(
    userMessage: string,
    conversationHistory: ChatCompletionMessageParam[] = [],
  ) {
    console.log("[AGENT TURN] Starting agent turn");

    if (typeof userMessage !== "string") {
      return {
        success: false,
        error: `user_message must be a string, got ${typeof userMessage}`,
        response: "I'm sorry, there was an error processing your message. Please try again.",
      };
    }

    const systemMessage: ChatCompletionMessageParam = {
      role: "system",
      content:
        "You are a helpful customer support agent. You can look up order " +
        "status, process refunds, and search the knowledge base for information. " +
        "Be polite, professional, and helpful. Use tools when necessary to " +
        "assist the customer.",
    };

    const messages: ChatCompletionMessageParam[] = [
      systemMessage,
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const llmResponse = await callLlmWithTools(messages, tools);

    if (!llmResponse.tool_calls.length) {
      console.log("[AGENT TURN] No tool calls, returning response");
      return {
        response: llmResponse.content,
        conversation_history: [
          ...conversationHistory,
          { role: "user" as const, content: userMessage },
          { role: "assistant" as const, content: llmResponse.content },
        ],
        tool_calls: [],
      };
    }

    console.log(`[AGENT TURN] Executing ${llmResponse.tool_calls.length} tool calls`);
    const toolResults: { tool: string; result: unknown }[] = [];

    for (const toolCall of llmResponse.tool_calls) {
      const result = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
      );
      toolResults.push({ tool: toolCall.function.name, result });
    }

    const toolMessages: ChatCompletionMessageParam[] = llmResponse.tool_calls.map((tc, i) => ({
      role: "tool" as const,
      tool_call_id: tc.id,
      content: JSON.stringify(toolResults[i].result),
    }));

    const finalMessages: ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: "assistant" as const,
        content: llmResponse.content,
        tool_calls: llmResponse.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      },
      ...toolMessages,
    ];

    const finalResponse = await callLlmWithTools(finalMessages, tools);

    console.log("[AGENT TURN] Agent turn complete");

    return {
      response: finalResponse.content,
      conversation_history: [
        ...conversationHistory,
        { role: "user" as const, content: userMessage },
        { role: "assistant" as const, content: finalResponse.content },
      ],
      tool_calls: toolResults,
    };
  },
);

// Root task: multi-turn conversation
task(
  { name: "multiTurnConversation", retry, timeoutSeconds: 300 },
  async function multiTurnConversation(...messages: string[]) {
    console.log("=".repeat(80));
    console.log(`[CONVERSATION] Starting multi-turn conversation with ${messages.length} messages`);
    console.log("=".repeat(80));

    let conversationHistory: ChatCompletionMessageParam[] = [];
    const responses: { turn: number; user: string; assistant: string | null; tool_calls: unknown[] }[] = [];

    for (let i = 0; i < messages.length; i++) {
      console.log(`[CONVERSATION] Turn ${i + 1}/${messages.length}`);

      const turnResult = await agentTurn(messages[i], conversationHistory);

      responses.push({
        turn: i + 1,
        user: messages[i],
        assistant: turnResult.response,
        tool_calls: turnResult.tool_calls ?? [],
      });

      conversationHistory = turnResult.conversation_history ?? [];
    }

    console.log("=".repeat(80));
    console.log("[CONVERSATION] Multi-turn conversation complete");
    console.log("=".repeat(80));

    return {
      turns: responses,
      total_turns: responses.length,
      conversation_history: conversationHistory,
    };
  },
);

// ============================================================
// Doc-Fix Workflow: Linear issue → GitHub PR via Scalekit
// ============================================================

interface IssuePayload {
  title: string;
  body: string;
  issueId: string;
  linearUserId: string;
}

interface ParsedIssue {
  owner: string;
  repo: string;
  filePath: string;
  fixDescription: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function parseIssueBody(body: string): Partial<ParsedIssue> {
  const repoMatch = body.match(/\*\*Docs Repo:\*\*\s*(https:\/\/github\.com\/[^\s]+)/i);
  const fileMatch = body.match(/\*\*File:\*\*\s*([^\n]+\.(?:md|mdx|rst|txt))/i);
  const fixMatch = body.match(/\*\*Fix:\*\*\s*([\s\S]+?)(?=\n\*\*|$)/i);

  const repoUrl = repoMatch?.[1];
  const parsed = repoUrl ? parseGitHubUrl(repoUrl) : null;

  return {
    ...(parsed ?? {}),
    filePath: fileMatch?.[1]?.trim(),
    fixDescription: fixMatch?.[1]?.trim(),
  };
}

// ---- Doc-Fix Helpers ----

/** Post a comment using the service LINEAR_API_KEY — no user OAuth required */
async function postServiceComment(issueId: string, body: string): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("[LINEAR] LINEAR_API_KEY not set — cannot post service comment");
    return;
  }
  try {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": apiKey },
      body: JSON.stringify({
        query: `mutation CommentCreate($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) { success }
        }`,
        variables: { issueId, body },
      }),
    });
    if (!res.ok) console.error(`[LINEAR] Service comment failed: ${res.statusText}`);
  } catch (err) {
    console.error("[LINEAR] Service comment error:", err);
  }
}

/** Detect Scalekit "no connected account" errors */
function isAuthError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("connected account") ||
    s.includes("not found") ||
    s.includes("unauthorized") ||
    s.includes("no active") ||
    s.includes("unauthenticated")
  );
}

// ---- Doc-Fix Tasks ----

const commentOnLinearIssue = task(
  { name: "commentOnLinearIssue", retry },
  async function commentOnLinearIssue(issueId: string, comment: string, linearUserId: string) {
    console.log(`[LINEAR] Commenting on issue ${issueId}`);
    await linearTool(linearUserId, "linear_graphql_query", {
      query: `
        mutation CommentCreate($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
            comment { id }
          }
        }
      `,
      variables: { issueId, body: comment },
    });
    console.log(`[LINEAR] Comment posted to ${issueId}`);
  },
);

const validateDocsRepo = task(
  { name: "validateDocsRepo", retry },
  async function validateDocsRepo(
    owner: string,
    repo: string,
    linearUserId: string,
  ): Promise<{ valid: boolean; reason: string }> {
    console.log(`[VALIDATE] Checking ${owner}/${repo}`);

    const repoData = await githubTool(linearUserId, "github_repo_get", { owner, repo }) as {
      name?: string;
      description?: string;
      topics?: string[];
    };

    const description = (repoData.description ?? "").toString().toLowerCase();
    const topics = (repoData.topics ?? []) as string[];

    // Check root directory for docs indicators
    let rootFiles: string[] = [];
    try {
      const contents = await githubTool(linearUserId, "github_file_contents_get", {
        owner,
        repo,
        path: "/",
      });
      rootFiles = (Array.isArray(contents) ? contents : []).map(
        (f: unknown) => (f as Record<string, string>).name ?? "",
      );
    } catch {
      // Non-fatal — continue with other checks
    }

    const docsIndicators = [
      "docs", "documentation", "docusaurus.config.js", "docusaurus.config.ts",
      "mkdocs.yml", ".vitepress", "book.toml", "_docs", "content",
    ];

    const hasIndicator =
      docsIndicators.some((d) => rootFiles.some((f) => f.toLowerCase().includes(d))) ||
      docsIndicators.some((d) => description.includes(d)) ||
      topics.some((t) => t.includes("docs") || t.includes("documentation"));

    if (!hasIndicator) {
      return {
        valid: false,
        reason: `${owner}/${repo} doesn't appear to be a documentation repository. No docs indicators found in root files, description, or topics.`,
      };
    }

    return { valid: true, reason: `${owner}/${repo} looks like a docs repo.` };
  },
);

const fetchDocsPage = task(
  { name: "fetchDocsPage", retry },
  async function fetchDocsPage(
    owner: string,
    repo: string,
    filePath: string,
    linearUserId: string,
  ): Promise<string> {
    console.log(`[FETCH] Getting ${owner}/${repo}/${filePath}`);

    const fileData = await githubTool(linearUserId, "github_file_contents_get", {
      owner,
      repo,
      path: filePath,
    }) as { content?: string; encoding?: string };

    if (!fileData.content) {
      throw `File not found or empty: ${filePath}`;
    }

    const content = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf-8");
    console.log(`[FETCH] Got ${content.length} chars from ${filePath}`);
    return content;
  },
);

const generateDocFix = task(
  { name: "generateDocFix", retry },
  async function generateDocFix(
    pageContent: string,
    fixDescription: string,
  ): Promise<{ fixedContent: string; summary: string }> {
    console.log("[LLM] Generating doc fix");

    const client = createOpenAIClient();
    const response = await client.chat.completions.create({
      model: process.env.LITELLM_MODEL ?? "claude-sonnet-4-6",
      messages: [
        {
          role: "system",
          content:
            "You are a technical documentation editor. Given the current content of a docs page and " +
            "a description of the fix needed, output a JSON object with two fields:\n" +
            '- "fixedContent": the complete corrected page content (full markdown, not a diff)\n' +
            '- "summary": one sentence describing what was changed\n' +
            "Output only valid JSON, no markdown fences.",
        },
        {
          role: "user",
          content:
            `Current page content:\n${pageContent}\n\n` +
            `Fix requested:\n${fixDescription}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    try {
      const result = JSON.parse(raw) as { fixedContent: string; summary: string };
      console.log(`[LLM] Fix generated: ${result.summary}`);
      return result;
    } catch {
      // Fallback if LLM didn't return clean JSON
      return { fixedContent: raw, summary: "Doc fix applied" };
    }
  },
);

const createGitHubPR = task(
  { name: "createGitHubPR", retry },
  async function createGitHubPR(
    fixedContent: string,
    owner: string,
    repo: string,
    filePath: string,
    issueId: string,
    prTitle: string,
    summary: string,
    linearUserId: string,
  ): Promise<{ prUrl: string }> {
    console.log(`[GITHUB] Creating PR in ${owner}/${repo}`);

    // 1. Get default branch
    let repoData: { default_branch: string };
    try {
      repoData = await githubTool(linearUserId, "github_repo_get", { owner, repo }) as { default_branch: string };
    } catch (err) {
      throw `createGitHubPR: could not access repo ${owner}/${repo} — ${err}`;
    }
    const defaultBranch = repoData.default_branch ?? "main";

    // 2. Get branch SHA
    const branchData = await githubTool(linearUserId, "github_branch_get", {
      owner,
      repo,
      branch: defaultBranch,
    }) as { commit: { sha: string } };
    const baseSha = branchData.commit.sha;

    // 3. Create new branch
    const newBranch = `docs-fix/linear-${issueId}`;
    await githubTool(linearUserId, "github_branch_create", {
      owner,
      repo,
      branch_name: newBranch,
      sha: baseSha,
    });
    console.log(`[GITHUB] Created branch ${newBranch}`);

    // 4. Get current file SHA (needed to update the file)
    const currentFile = await githubTool(linearUserId, "github_file_contents_get", {
      owner,
      repo,
      path: filePath,
      ref: newBranch,
    }) as { sha: string };

    // 5. Commit fixed content
    const base64Content = Buffer.from(fixedContent).toString("base64");
    await githubTool(linearUserId, "github_file_create_update", {
      owner,
      repo,
      path: filePath,
      message: `docs: ${summary}`,
      content: base64Content,
      sha: currentFile.sha,
      branch: newBranch,
    });
    console.log(`[GITHUB] Committed fix to ${newBranch}`);

    // 6. Open PR
    const prData = await githubTool(linearUserId, "github_pull_request_create", {
      owner,
      repo,
      head: newBranch,
      base: defaultBranch,
      title: prTitle,
      body:
        `${summary}\n\n` +
        `Triggered by Linear issue: ${issueId}\n\n` +
        `---\n*Automated by Render Workflows + Scalekit*`,
    }) as { html_url: string };

    console.log(`[GITHUB] PR created: ${prData.html_url}`);
    return { prUrl: prData.html_url };
  },
);

// Root task: orchestrates the full doc-fix flow
task(
  { name: "processIssue", retry, timeoutSeconds: 300 },
  async function processIssue(payload: IssuePayload) {
    const { title, body, issueId, linearUserId } = payload;
    console.log(`[DOC-FIX] Processing issue ${issueId}: "${title}"`);

    // 1. Parse issue body for repo, file, and fix description
    const parsed = parseIssueBody(body);

    if (!parsed.owner || !parsed.repo || !parsed.filePath || !parsed.fixDescription) {
      const missing = [
        !parsed.owner && "**Docs Repo**",
        !parsed.filePath && "**File**",
        !parsed.fixDescription && "**Fix**",
      ]
        .filter(Boolean)
        .join(", ");

      await postServiceComment(
        issueId,
        `I couldn't process this issue automatically. Missing fields: ${missing}\n\n` +
        `Please format your issue like:\n\`\`\`\n` +
        `**Docs Repo:** https://github.com/org/repo\n` +
        `**File:** docs/getting-started/quickstart.md\n` +
        `**Fix:** Describe what needs to change\n\`\`\``,
      );
      return { success: false, reason: "Missing required fields in issue body" };
    }

    const { owner, repo, filePath, fixDescription } = parsed as ParsedIssue;

    // 2–5. Run GitHub-dependent steps — catch auth errors and prompt user to connect
    let prUrl: string;
    try {
      // 2. Validate it's actually a docs repo
      const validation = await validateDocsRepo(owner, repo, linearUserId);
      if (!validation.valid) {
        await postServiceComment(issueId, `⚠️ ${validation.reason}`);
        return { success: false, reason: validation.reason };
      }

      // 3. Fetch the docs page
      let pageContent: string;
      try {
        pageContent = await fetchDocsPage(owner, repo, filePath, linearUserId);
      } catch (err) {
        await postServiceComment(
          issueId,
          `❌ Couldn't fetch \`${filePath}\` from \`${owner}/${repo}\`. ` +
          `Please check the file path is correct.\n\nError: ${String(err)}`,
        );
        return { success: false, reason: String(err) };
      }

      // 4. Generate the fix
      const { fixedContent, summary } = await generateDocFix(pageContent, fixDescription);

      // 5. Create PR
      ({ prUrl } = await createGitHubPR(
        fixedContent, owner, repo, filePath, issueId, title, summary, linearUserId,
      ));
    } catch (err) {
      if (isAuthError(err)) {
        console.log(`[DOC-FIX] GitHub not connected for user ${linearUserId} — sending auth prompt`);
        const authBaseUrl = process.env.AUTH_BASE_URL ?? "http://localhost:3002";
        const authLink = await getAuthLink(
          linearUserId,
          "github",
          `${authBaseUrl}/callback?userId=${encodeURIComponent(linearUserId)}`,
        );
        await postServiceComment(
          issueId,
          `👋 To process this doc fix automatically, I need access to your GitHub account.\n\n` +
          `**[Connect GitHub →](${authLink})**\n\n` +
          `Once connected, edit or re-open this issue to retry.`,
        );
        return { success: false, reason: "github_auth_required" };
      }
      throw err;
    }

    // 6. Comment on Linear issue with PR link
    await postServiceComment(
      issueId,
      `✅ PR raised: ${prUrl}\n\nReady for your review.`,
    );

    console.log(`[DOC-FIX] Done. PR: ${prUrl}`);
    return { success: true, prUrl };
  },
);
