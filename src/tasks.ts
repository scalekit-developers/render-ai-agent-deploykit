import { task } from "@renderinc/sdk/workflows";
import OpenAI from "openai";
import { githubRequest, githubTool, getGitHubAuthLink } from "./scalekit.js";

// ---- Types ----

export interface PRSummaryInput {
  identifier: string;
  owner: string;
  repo: string;
}

interface PRListItem {
  number: number;
  title: string;
  comments: number;
  review_comments: number;
}

interface PRDetail {
  number: number;
  title: string;
  totalComments: number;
  diff: string;
  commentBodies: string[];
}

// ---- LLM client ----

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("LITELLM_API_KEY environment variable not set.");
  }
  const options: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  if (process.env.LITELLM_BASE_URL) {
    options.baseURL = process.env.LITELLM_BASE_URL;
  }
  return new OpenAI(options);
}

// ---- Tasks ----

/**
 * Fetch open PRs for a repo via Scalekit's GitHub tool proxy.
 * Returns the top 5 by total comment count (issue comments + review comments).
 */
const fetchOpenPRs = task(
  { name: "fetchOpenPRs", retry: { maxRetries: 3, waitDurationMs: 1000 } },
  async function fetchOpenPRs(
    identifier: string,
    owner: string,
    repo: string,
  ): Promise<PRListItem[]> {
    console.log(`[fetchOpenPRs] Listing open PRs for ${owner}/${repo}`);

    const raw = await githubTool(identifier, "github_pull_requests_list", {
      owner,
      repo,
      state: "open",
    });

    console.log(`[fetchOpenPRs] raw response keys:`, Object.keys(raw));
    console.log(`[fetchOpenPRs] raw response:`, JSON.stringify(raw).slice(0, 500));

    // Scalekit wraps arrays in an "array" key — handle all known shapes
    const r = raw as Record<string, unknown>;
    const list = Array.isArray(raw)
      ? raw as unknown as PRListItem[]
      : Array.isArray(r.array) ? r.array as PRListItem[]
      : Array.isArray(r.pull_requests) ? r.pull_requests as PRListItem[]
      : Array.isArray(r.data) ? r.data as PRListItem[]
      : null;

    if (!list) {
      throw new Error(`Unexpected PR list response shape: ${JSON.stringify(raw).slice(0, 300)}`);
    }

    console.log(`[fetchOpenPRs] Found ${list.length} open PRs`);

    const sorted = [...list].sort(
      (a, b) => (b.comments + b.review_comments) - (a.comments + a.review_comments),
    );

    return sorted.slice(0, 5);
  },
);

/**
 * Fetch the raw diff and comment thread for a single PR via Scalekit's tool proxy.
 * The diff is truncated to 3000 chars to keep LLM context manageable.
 */
const fetchPRDetails = task(
  { name: "fetchPRDetails", retry: { maxRetries: 3, waitDurationMs: 1000 } },
  async function fetchPRDetails(
    identifier: string,
    owner: string,
    repo: string,
    prNumber: number,
    title: string,
    totalComments: number,
  ): Promise<PRDetail> {
    console.log(`[fetchPRDetails] Fetching PR #${prNumber}: ${title}`);

    const [diffRaw, commentsRaw] = await Promise.all([
      githubRequest(identifier, `/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: { Accept: "application/vnd.github.diff" },
      }),
      githubRequest(identifier, `/repos/${owner}/${repo}/issues/${prNumber}/comments`),
    ]);

    const diff = typeof diffRaw === "string" ? diffRaw.slice(0, 3000) : "";
    const commentsJson = Array.isArray(commentsRaw) ? commentsRaw as Array<{ body?: string }> : [];
    const commentBodies = commentsJson.slice(0, 20).map((c) => c.body ?? "").filter(Boolean);

    console.log(`[fetchPRDetails] PR #${prNumber}: ${diff.length} diff chars, ${commentBodies.length} comments`);

    return { number: prNumber, title, totalComments, diff, commentBodies };
  },
);

/**
 * Call the LLM (via LiteLLM proxy) to generate one paragraph per PR.
 * Returns a formatted markdown string with a section for each PR.
 */
const generateSummary = task(
  { name: "generateSummary", retry: { maxRetries: 3, waitDurationMs: 2000 } },
  async function generateSummary(
    prs: PRDetail[],
    owner: string,
    repo: string,
  ): Promise<string> {
    if (prs.length === 0) {
      return "No open pull requests found in this repository.";
    }

    console.log(`[generateSummary] Summarizing ${prs.length} PRs for ${owner}/${repo}`);

    const client = createOpenAIClient();

    const prBlocks = prs
      .map((pr) => {
        const commentSection =
          pr.commentBodies.length > 0
            ? `Discussion (${pr.totalComments} comments):\n${pr.commentBodies
                .slice(0, 5)
                .map((c) => `> ${c.slice(0, 300).replace(/\n/g, " ")}`)
                .join("\n")}`
            : `No comments yet (${pr.totalComments} total).`;

        return [
          `PR #${pr.number} — ${pr.title}`,
          commentSection,
          `Code changes (first 3000 chars of diff):\n${pr.diff || "(diff not available)"}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    const response = await client.chat.completions.create({
      model: process.env.LITELLM_MODEL ?? "claude-haiku-4-5",
      messages: [
        {
          role: "system",
          content: [
            "You are summarizing GitHub pull request activity for a team lead or manager.",
            "For each pull request provided, write exactly one paragraph (3-4 sentences) in plain, non-technical language.",
            "Each paragraph should cover: what the change is about in plain terms, how much discussion or review has happened, and whether it appears close to being merged or still needs significant work.",
            "Do not use bullet points or code snippets.",
            "",
            "Format your response exactly like this, repeating the block for each PR:",
            "",
            "**PR #[number] — [title]**",
            "[Your paragraph here]",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Repository: ${owner}/${repo}\n\nTop open pull requests by discussion volume:\n\n${prBlocks}`,
        },
      ],
    });

    return response.choices[0].message.content ?? "(no summary generated)";
  },
);

// ---- Setup task ----

/**
 * One-time setup: create or retrieve the GitHub connected account for a user
 * and return the OAuth authorization URL. The user must open the URL and
 * authorize GitHub access. After authorization, Scalekit redirects to
 * userVerifyUrl where the server binds the token to the session.
 */
export const setupGitHubAuthTask = task(
  { name: "setupGitHubAuth" },
  async function setupGitHubAuth(params: {
    identifier: string;
    state: string;
    userVerifyUrl: string;
  }) {
    console.log(`[setupGitHubAuth] Getting auth link for identifier ${params.identifier}`);
    const link = await getGitHubAuthLink(params.identifier, {
      state: params.state,
      userVerifyUrl: params.userVerifyUrl,
    });
    console.log(`[setupGitHubAuth] Auth link generated`);
    return { authLink: link };
  },
);

// ---- Root task ----

/**
 * Summarize the most-discussed open PRs in a public or private GitHub repository.
 */
export const summarizePRsTask = task(
  { name: "summarizePRs", timeoutSeconds: 120 },
  async function summarizePRs(input: PRSummaryInput) {
    const { identifier, owner, repo } = input;
    console.log(`[summarizePRs] Starting for ${owner}/${repo}`);

    const topPRs = await fetchOpenPRs(identifier, owner, repo);

    if (topPRs.length === 0) {
      return {
        repository: `${owner}/${repo}`,
        prsAnalyzed: [],
        summary: "No open pull requests found in this repository.",
      };
    }

    const details = await Promise.all(
      topPRs.map((pr) =>
        fetchPRDetails(identifier, owner, repo, pr.number, pr.title, pr.comments + pr.review_comments),
      ),
    );

    const summary = await generateSummary(details, owner, repo);

    console.log(`[summarizePRs] Done. Summarized ${details.length} PRs.`);

    return {
      repository: `${owner}/${repo}`,
      prsAnalyzed: topPRs.map((p) => `#${p.number}: ${p.title}`),
      summary,
    };
  },
);
