export function renderHomePage({ connected }: { connected: boolean }): string {
  const connectedBanner = connected
    ? `<div class="connected-banner">&#10003; GitHub connected — enter a repository below to summarize pull requests.</div>`
    : `<div class="not-connected-banner">Step 1: Connect your GitHub account before summarizing pull requests.</div>`;
  const authHeading = connected ? "GitHub connected" : "Step 1 — Connect GitHub";
  const authSubtitle = connected
    ? "Your current browser session is already connected to GitHub. Click below if you want to reconnect with a different account."
    : "Connect your GitHub account once. The app links your session to your GitHub OAuth token — no user ID required.";
  const authButtonLabel = connected ? "Reconnect GitHub" : "Connect GitHub";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-User GitHub PR Summarizer Agent</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.4rem; }
    header p { color: #555; font-size: 0.95rem; }
    .header-links {
      margin-top: 0.75rem;
      font-size: 0.88rem;
    }
    .header-links a { color: #1a6ef0; font-weight: 500; }
    .header-links a:hover { text-decoration: underline; }
    .header-links-sep { color: #aaa; margin: 0 0.4rem; user-select: none; }

    /* Two-column layout */
    .layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 780px) {
      .layout { grid-template-columns: 1fr; }
    }

    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card:last-child { margin-bottom: 0; }
    .card h2 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.3rem; }
    .card .subtitle { color: #666; font-size: 0.85rem; margin-bottom: 1.2rem; }
    .card .subtitle code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.82rem;
      background: #f0f0f0;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.3rem; color: #333; }
    input[type="text"] {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="text"]:focus { border-color: #4a6cf7; }
    .row { display: flex; gap: 0.75rem; }
    .row .field { flex: 1; }
    button {
      display: inline-block;
      padding: 0.6rem 1.25rem;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #333; }
    button:disabled { background: #999; cursor: not-allowed; }

    .connected-banner {
      background: #f0faf4;
      border: 1px solid #a3d9b1;
      border-radius: 6px;
      padding: 0.6rem 1rem;
      color: #1a6e38;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
    }
    .not-connected-banner {
      background: #fffbec;
      border: 1px solid #f0d070;
      border-radius: 6px;
      padding: 0.6rem 1rem;
      color: #7a5c00;
      font-size: 0.88rem;
      margin-bottom: 1.5rem;
    }

    /* Auth result stays inside Step 1 card */
    .auth-result { margin-top: 1.25rem; }
    .auth-result.hidden { display: none; }
    .auth-link-box {
      background: #f0f7ff;
      border: 1px solid #b3d4f7;
      border-radius: 6px;
      padding: 1rem;
      font-size: 0.9rem;
    }
    .error-box {
      background: #fff5f5;
      border: 1px solid #f5c6cb;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      color: #c0392b;
      font-size: 0.88rem;
    }

    /* Right panel — summary output */
    .right-panel {
      position: sticky;
      top: 2rem;
    }
    .summary-panel {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      min-height: 420px;
      display: flex;
      flex-direction: column;
    }
    .summary-panel-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e0e0e0;
      font-size: 0.95rem;
      font-weight: 600;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .summary-panel-body {
      padding: 1.5rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .summary-placeholder {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #aaa;
      font-size: 0.9rem;
      text-align: center;
      gap: 0.5rem;
    }
    .summary-placeholder-icon { font-size: 2rem; opacity: 0.4; }
    .summary-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: #555;
      font-size: 0.9rem;
    }
    .spinner {
      display: inline-block;
      width: 20px; height: 20px;
      border: 2px solid #ddd;
      border-top-color: #555;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .summary-content { display: flex; flex-direction: column; gap: 1rem; }
    .summary-meta {
      font-size: 0.8rem;
      color: #888;
    }
    .prs-list { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.25rem; }
    .prs-list span {
      display: inline-block;
      background: #eef2ff;
      color: #3a3aaa;
      border-radius: 4px;
      padding: 0.15rem 0.5rem;
      font-size: 0.78rem;
    }
    .summary-text {
      background: #fafafa;
      border: 1px solid #e8e8e8;
      border-radius: 6px;
      padding: 1rem 1.25rem;
      font-size: 0.9rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .summary-error {
      background: #fff5f5;
      border: 1px solid #f5c6cb;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      color: #c0392b;
      font-size: 0.88rem;
    }

    details.card-collapsible {
      padding: 0;
      overflow: hidden;
    }
    details.card-collapsible > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      user-select: none;
    }
    details.card-collapsible > summary::-webkit-details-marker { display: none; }
    details.card-collapsible > summary::marker { content: ''; }
    .collapsible-summary-text {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }
    .collapsible-summary-text strong {
      font-size: 1.05rem;
      font-weight: 600;
    }
    .collapsible-summary-hint {
      font-size: 0.82rem;
      color: #666;
      font-weight: 400;
    }
    .collapsible-chevron {
      flex-shrink: 0;
      font-size: 0.65rem;
      color: #666;
      transition: transform 0.2s ease;
    }
    details.card-collapsible[open] .collapsible-chevron {
      transform: rotate(90deg);
    }
    .collapsible-body {
      padding: 0 1.5rem 1.5rem;
      border-top: 1px solid #eee;
    }
    .collapsible-body .subtitle { margin-top: 1rem; }
    .help-list {
      font-size: 0.85rem;
      color: #444;
      line-height: 1.55;
      padding-left: 1.15rem;
      margin-top: 0.25rem;
    }
    .help-list li { margin-bottom: 0.65rem; }
    .help-list li:last-child { margin-bottom: 0; }
    .help-list code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      background: #f0f0f0;
      padding: 0.12rem 0.35rem;
      border-radius: 4px;
    }
    .help-list a { color: #1a6ef0; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>Multi-User GitHub PR Summarizer Agent</h1>
    <p>Summarize the most-discussed open pull requests in any GitHub repository using AI.</p>
    <p class="header-links">
      <a href="https://github.com/scalekit-developers/render-ai-agent-deploykit/blob/main/README.md" target="_blank" rel="noopener noreferrer">README on GitHub</a>
      <span class="header-links-sep" aria-hidden="true">·</span>
      <a href="https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/" target="_blank" rel="noopener noreferrer">Scalekit cookbook</a>
    </p>
  </header>

  ${connectedBanner}

  <details class="card card-collapsible" style="margin-bottom:1.5rem">
    <summary>
      <span class="collapsible-summary-text">
        <strong>Environment variables</strong>
        <span class="collapsible-summary-hint">Scalekit, LiteLLM &amp; Blueprint — click to expand</span>
      </span>
      <span class="collapsible-chevron" aria-hidden="true">&#9654;</span>
    </summary>
    <div class="collapsible-body">
      <p class="subtitle">The API needs Scalekit and LiteLLM settings. Configure them on Render (or in a local <code>.env</code> for development).</p>
      <ul class="help-list">
        <li><strong>Where to find values:</strong> In the <a href="https://app.scalekit.com" target="_blank" rel="noopener noreferrer">Scalekit dashboard</a>, use your app credentials for <code>SCALEKIT_ENVIRONMENT_URL</code>, <code>SCALEKIT_CLIENT_ID</code>, and <code>SCALEKIT_CLIENT_SECRET</code>. Under <strong>Agent Auth → Connectors</strong>, copy the GitHub connection name into <code>GITHUB_CONNECTION_NAME</code>. Set <code>LITELLM_API_KEY</code> and <code>LITELLM_BASE_URL</code> from your LiteLLM proxy (the repo's <code>.env.example</code> shows the expected shape).</li>
        <li><strong>Session security:</strong> Generate a random <code>SESSION_SECRET</code> with <code>openssl rand -hex 32</code>. Set <code>PUBLIC_BASE_URL</code> to your service's public URL (e.g. <code>https://your-service.onrender.com</code>).</li>
        <li><strong>On Render:</strong> <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer">Dashboard</a> → your web service → <strong>Environment</strong> → add or edit each variable.</li>
        <li><strong>Blueprint (<code>render.yaml</code>):</strong> Variables are listed under <code>envVars</code>. Any entry with <code>sync: false</code> is a secret you enter at deploy time or in <strong>Environment</strong>; it is not stored in the repository.</li>
      </ul>
    </div>
  </details>

  <div class="layout">
    <!-- Left column: forms -->
    <div class="left-panel">

      <!-- Step 1: Connect GitHub -->
      <div class="card">
        <h2>${authHeading}</h2>
        <p class="subtitle">${authSubtitle}</p>
        <button id="auth-btn" onclick="connectGitHub()">${authButtonLabel}</button>
        <div class="auth-result hidden" id="auth-result"></div>
      </div>

      <!-- Step 2: Summarize PRs -->
      <div class="card">
        <h2>Step 2 — Summarize pull requests</h2>
        <p class="subtitle">Paste a GitHub repository URL or an <code>owner/repo</code> value. Public repositories work with any connected GitHub account. Private repositories only work if the connected account has access.</p>
        <div class="field">
          <label for="sum-repository">GitHub repository</label>
          <input type="text" id="sum-repository" placeholder="https://github.com/render-oss/sdk" autocomplete="off">
        </div>
        <button id="sum-btn" onclick="summarize()">Summarize PRs</button>
      </div>

    </div>

    <!-- Right column: summary output -->
    <div class="right-panel">
      <div class="summary-panel">
        <div class="summary-panel-header">
          <span>Summary</span>
        </div>
        <div class="summary-panel-body" id="summary-panel-body">
          <div class="summary-placeholder" id="summary-placeholder">
            <span class="summary-placeholder-icon">&#128196;</span>
            <span>Fill in the form and click <strong>Summarize PRs</strong> to see results here.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function mdToHtml(md) {
    return escHtml(md)
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  }

  async function connectGitHub() {
    const resultEl = document.getElementById('auth-result');
    const btn = document.getElementById('auth-btn');

    btn.disabled = true;
    resultEl.className = 'auth-result';
    resultEl.innerHTML = '<div style="color:#555;font-size:0.88rem;margin-top:0.5rem">Generating authorization link...</div>';

    try {
      const res = await fetch('/api/auth', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      // Redirect the whole window through the OAuth flow.
      // After authorization, Scalekit redirects back to /user/verify, which
      // validates the session and then redirects to / with connected status.
      window.location.href = data.authLink;
    } catch (err) {
      resultEl.innerHTML = \`<div class="error-box" style="margin-top:1rem">\${escHtml(err.message)}</div>\`;
      btn.disabled = false;
    }
  }

  async function summarize() {
    const repository = document.getElementById('sum-repository').value.trim();
    const panelBody = document.getElementById('summary-panel-body');
    const btn = document.getElementById('sum-btn');
    if (!repository) { alert('Enter a GitHub repository URL or owner/repo value'); return; }

    btn.disabled = true;
    panelBody.innerHTML = \`
      <div class="summary-loading">
        <div class="spinner"></div>
        <span>Fetching PRs and generating summaries&hellip;<br><span style="font-size:0.8rem;color:#aaa">This may take up to 2 minutes.</span></span>
      </div>\`;

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const prsHtml = data.prsAnalyzed && data.prsAnalyzed.length
        ? \`<div class="prs-list">\${data.prsAnalyzed.map(p => \`<span>\${escHtml(p)}</span>\`).join('')}</div>\`
        : '';

      panelBody.innerHTML = \`
        <div class="summary-content">
          <div class="summary-meta">\${escHtml(data.repository)} &middot; top \${data.prsAnalyzed?.length ?? 0} PRs by discussion</div>
          \${prsHtml}
          <div class="summary-text">\${mdToHtml(data.summary)}</div>
        </div>\`;
    } catch (err) {
      panelBody.innerHTML = \`<div class="summary-error">\${escHtml(err.message)}</div>\`;
    } finally {
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}
