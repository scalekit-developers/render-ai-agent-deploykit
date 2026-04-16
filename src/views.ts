export function renderHomePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Render PR Summarizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container { max-width: 680px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.4rem; }
    header p { color: #555; font-size: 0.95rem; }
    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.3rem; }
    .card .subtitle { color: #666; font-size: 0.85rem; margin-bottom: 1.2rem; }
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
    .result { margin-top: 1.25rem; }
    .result.hidden { display: none; }
    .auth-link-box {
      background: #f0f7ff;
      border: 1px solid #b3d4f7;
      border-radius: 6px;
      padding: 1rem;
      font-size: 0.9rem;
    }
    .auth-link-box a {
      color: #1a6ef0;
      word-break: break-all;
      font-weight: 500;
    }
    .summary-box {
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 1rem;
      font-size: 0.9rem;
      line-height: 1.65;
      white-space: pre-wrap;
    }
    .summary-box strong { font-weight: 600; }
    .error-box {
      background: #fff5f5;
      border: 1px solid #f5c6cb;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      color: #c0392b;
      font-size: 0.88rem;
    }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid #ccc;
      border-top-color: #555;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-msg { color: #555; font-size: 0.88rem; margin-top: 0.75rem; }
    .prs-list { margin-bottom: 0.75rem; }
    .prs-list span {
      display: inline-block;
      background: #eef2ff;
      color: #3a3aaa;
      border-radius: 4px;
      padding: 0.15rem 0.5rem;
      font-size: 0.8rem;
      margin: 0.15rem 0.2rem 0.15rem 0;
    }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>Render PR Summarizer</h1>
    <p>Summarize the most-discussed open pull requests in any GitHub repository using AI.</p>
  </header>

  <!-- Step 1: Auth Setup -->
  <div class="card">
    <h2>Step 1 — Connect GitHub</h2>
    <p class="subtitle">Run once per user. Generates an OAuth link to authorize GitHub access.</p>
    <div class="field">
      <label for="auth-user-id">User ID</label>
      <input type="text" id="auth-user-id" placeholder="e.g. alice" autocomplete="off">
    </div>
    <button id="auth-btn" onclick="setupAuth()">Get GitHub Auth Link</button>
    <div class="result hidden" id="auth-result"></div>
  </div>

  <!-- Step 2: Summarize PRs -->
  <div class="card">
    <h2>Step 2 — Summarize Pull Requests</h2>
    <p class="subtitle">Enter your user ID and a GitHub repository to generate AI summaries of the top 5 most-discussed open PRs.</p>
    <div class="field">
      <label for="sum-user-id">User ID</label>
      <input type="text" id="sum-user-id" placeholder="e.g. alice" autocomplete="off">
    </div>
    <div class="row">
      <div class="field">
        <label for="sum-owner">Owner</label>
        <input type="text" id="sum-owner" placeholder="e.g. render-oss" autocomplete="off">
      </div>
      <div class="field">
        <label for="sum-repo">Repository</label>
        <input type="text" id="sum-repo" placeholder="e.g. sdk" autocomplete="off">
      </div>
    </div>
    <button id="sum-btn" onclick="summarize()">Summarize PRs</button>
    <div class="result hidden" id="sum-result"></div>
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

  async function setupAuth() {
    const userId = document.getElementById('auth-user-id').value.trim();
    const resultEl = document.getElementById('auth-result');
    const btn = document.getElementById('auth-btn');
    if (!userId) { alert('Enter a user ID'); return; }

    btn.disabled = true;
    resultEl.className = 'result';
    resultEl.innerHTML = '<span class="spinner"></span><span class="status-msg">Generating auth link...</span>';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      resultEl.innerHTML = \`
        <div class="auth-link-box">
          <p style="margin-bottom:0.5rem">Open this link in your browser to connect <strong>\${escHtml(userId)}</strong>'s GitHub account:</p>
          <a href="\${escHtml(data.authLink)}" target="_blank" rel="noopener noreferrer">\${escHtml(data.authLink)}</a>
          <p style="margin-top:0.5rem;color:#555;font-size:0.82rem">After authorizing, come back and use Step 2.</p>
        </div>\`;
    } catch (err) {
      resultEl.innerHTML = \`<div class="error-box">\${escHtml(err.message)}</div>\`;
    } finally {
      btn.disabled = false;
    }
  }

  async function summarize() {
    const userId = document.getElementById('sum-user-id').value.trim();
    const owner  = document.getElementById('sum-owner').value.trim();
    const repo   = document.getElementById('sum-repo').value.trim();
    const resultEl = document.getElementById('sum-result');
    const btn = document.getElementById('sum-btn');
    if (!userId || !owner || !repo) { alert('Fill in all fields'); return; }

    btn.disabled = true;
    resultEl.className = 'result';
    resultEl.innerHTML = '<span class="spinner"></span><span class="status-msg">Fetching PRs and generating summaries — this may take up to 2 minutes...</span>';

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const prsHtml = data.prsAnalyzed && data.prsAnalyzed.length
        ? \`<div class="prs-list">\${data.prsAnalyzed.map(p => \`<span>\${escHtml(p)}</span>\`).join('')}</div>\`
        : '';

      resultEl.innerHTML = \`
        \${prsHtml}
        <div class="summary-box">\${mdToHtml(data.summary)}</div>\`;
    } catch (err) {
      resultEl.innerHTML = \`<div class="error-box">\${escHtml(err.message)}</div>\`;
    } finally {
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}
