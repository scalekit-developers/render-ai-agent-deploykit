export function renderAuthCompletePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/favicon.png">
  <title>GitHub Connected</title>
  <style>
    /* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: Cobalt
     * product: GitHub PR summarizer (SSR template) · enrichment: none
     * pre-emit critique: P4 H4 E4 S4 R4 V3
     */
    :root {
      --color-paper: oklch(98.5% 0.004 250);
      --color-surface: oklch(100% 0 0);
      --color-ink: oklch(22% 0.02 255);
      --color-muted: oklch(48% 0.02 255);
      --color-border: oklch(90% 0.01 255);
      --color-success: oklch(45% 0.1 155);
      --color-success-bg: oklch(96% 0.02 155);
      --color-success-border: oklch(86% 0.05 155);
      --color-accent: oklch(52% 0.16 255);
      --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --radius: 8px;
      --shadow: 0 1px 2px oklch(22% 0.02 255 / 0.06);
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --dur-short: 150ms;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font-sans);
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: var(--color-paper);
      color: var(--color-ink);
      -webkit-font-smoothing: antialiased;
    }
    .box {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 2rem 2.25rem;
      text-align: left;
      max-width: 26rem;
      width: calc(100% - 2rem);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 999px;
      background: var(--color-success-bg);
      border: 1px solid var(--color-success-border);
      color: var(--color-success);
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.85rem;
      opacity: 1;
      transform: scale(1);
      transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out);
    }
    @starting-style {
      .badge {
        opacity: 0;
        transform: scale(0.95);
      }
    }
    h1 {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      margin: 0 0 0.4rem;
      text-wrap: balance;
      font-style: normal;
    }
    p { color: var(--color-muted); font-size: 0.94rem; line-height: 1.55; margin: 0; text-wrap: pretty; }
    ::selection { background: oklch(52% 0.16 255 / 0.18); color: var(--color-ink); }
    @media (prefers-reduced-motion: reduce) {
      .badge { transition: none; }
      @starting-style { .badge { opacity: 1; transform: none; } }
    }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge" aria-hidden="true">&#10003;</div>
    <h1>GitHub connected</h1>
    <p>You can close this tab and return to the app. The original page will update automatically.</p>
  </div>
</body>
</html>`;
}

export function renderHomePage({ connected }: { connected: boolean }): string {
  const connectedBanner = connected
    ? `<div class="banner banner-success" role="status">
        <span class="banner-dot" aria-hidden="true"></span>
        <span><strong>GitHub connected</strong> — enter a repository below to summarize pull requests.</span>
      </div>`
    : `<div class="banner banner-warn" role="status">
        <span class="banner-dot" aria-hidden="true"></span>
        <span><strong>Step 1 first:</strong> Connect your GitHub account before summarizing pull requests.</span>
      </div>`;
  const authHeading = connected ? "GitHub connected" : "Connect GitHub";
  const authStep = connected ? "Ready" : "Step 1";
  const authSubtitle = connected
    ? "Your current browser session is already connected to GitHub. Reconnect if you want a different account."
    : "Connect your GitHub account once. The app links your session to your OAuth token — no user ID field.";
  const authButtonLabel = connected ? "Reconnect GitHub" : "Connect GitHub";
  const authButtonClass = connected ? "btn btn-secondary" : "btn btn-primary";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/favicon.png">
  <title>GitHub PR Summarizer</title>
  <style>
    /* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: Cobalt
     * product: GitHub PR summarizer (SSR template) · enrichment: none · studied: no
     * states: default · hover · focus-visible · active · disabled · loading · error · success
     * pre-emit critique: P4 H4 E4 S4 R4 V3
     */
    :root {
      --color-paper: oklch(98.2% 0.005 250);
      --color-surface: oklch(100% 0 0);
      --color-ink: oklch(20% 0.02 255);
      --color-muted: oklch(48% 0.018 255);
      --color-subtle: oklch(62% 0.015 255);
      --color-border: oklch(90% 0.01 255);
      --color-border-strong: oklch(82% 0.015 255);
      --color-accent: oklch(52% 0.16 255);
      --color-accent-soft: oklch(96% 0.02 255);
      --color-accent-ink: oklch(40% 0.12 255);
      --color-success: oklch(42% 0.1 155);
      --color-success-bg: oklch(96.5% 0.02 155);
      --color-success-border: oklch(86% 0.05 155);
      --color-warn: oklch(42% 0.09 75);
      --color-warn-bg: oklch(97% 0.03 90);
      --color-warn-border: oklch(88% 0.06 90);
      --color-danger: oklch(48% 0.17 25);
      --color-danger-bg: oklch(97% 0.02 25);
      --color-danger-border: oklch(88% 0.05 25);
      --color-control: oklch(98.8% 0.003 250);
      --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --radius: 8px;
      --radius-sm: 6px;
      --shadow: 0 1px 2px oklch(20% 0.02 255 / 0.05);
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-5: 1.25rem;
      --space-6: 1.5rem;
      --target: 2.75rem;
      /* Strong ease-out for UI interactions (Emil / animations.dev) */
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      --dur-press: 150ms;
      --dur-short: 150ms;
      --dur-med: 180ms;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { overflow-x: clip; }
    body {
      font-family: var(--font-sans);
      color: var(--color-ink);
      min-height: 100vh;
      background: var(--color-paper);
      padding: var(--space-6) var(--space-5) 3rem;
      -webkit-font-smoothing: antialiased;
      font-optical-sizing: auto;
    }
    ::selection { background: oklch(52% 0.16 255 / 0.18); color: var(--color-ink); }
    .container { max-width: 68rem; margin: 0 auto; }

    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4) var(--space-6);
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-width: 38rem;
      min-width: 0;
    }
    header h1 {
      font-size: clamp(1.35rem, 1.8vw + 0.9rem, 1.75rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.15;
      text-wrap: balance;
      font-style: normal;
      overflow-wrap: anywhere;
    }
    header .lede {
      color: var(--color-muted);
      font-size: 0.95rem;
      line-height: 1.55;
      text-wrap: pretty;
      max-width: 36rem;
    }
    .header-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem 0.85rem;
      font-size: 0.86rem;
      margin-top: 0.35rem;
    }
    .header-links a {
      color: var(--color-accent-ink);
      font-weight: 500;
      text-decoration: none;
      text-underline-offset: 0.18em;
      min-height: 2rem;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .header-links a:hover { text-decoration: underline; }
    }
    .header-links a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 3px;
      border-radius: 4px;
    }
    .header-links-sep { color: var(--color-subtle); user-select: none; }

    .banner {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.9rem;
      font-size: 0.9rem;
      line-height: 1.45;
      margin-bottom: var(--space-5);
      border: 1px solid transparent;
    }
    .banner-dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 999px;
      margin-top: 0.45rem;
      flex-shrink: 0;
      background: currentColor;
    }
    .banner-success {
      background: var(--color-success-bg);
      border-color: var(--color-success-border);
      color: var(--color-success);
    }
    .banner-warn {
      background: var(--color-warn-bg);
      border-color: var(--color-warn-border);
      color: var(--color-warn);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }
    @media (max-width: 840px) {
      .layout { grid-template-columns: 1fr; }
      .right-panel { position: static; }
      body { padding: var(--space-5) var(--space-4) 2.5rem; }
    }

    .card, .summary-panel, details.card-collapsible {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .card {
      padding: var(--space-5);
      margin-bottom: var(--space-4);
    }
    .card:last-child { margin-bottom: 0; }
    .card-head {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.3rem;
      margin-bottom: 0.35rem;
    }
    .step-pill {
      display: inline-flex;
      align-items: center;
      min-height: 1.25rem;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-subtle);
      font-family: var(--font-mono);
    }
    .step-pill.ready { color: var(--color-success); }
    .card h2 {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      text-wrap: balance;
      font-style: normal;
    }
    .card .subtitle {
      color: var(--color-muted);
      font-size: 0.88rem;
      line-height: 1.5;
      margin: 0.35rem 0 1.1rem;
    }
    .card .subtitle code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: var(--color-control);
      border: 1px solid var(--color-border);
      padding: 0.08rem 0.32rem;
      border-radius: 4px;
      color: var(--color-ink);
    }

    .field { margin-bottom: var(--space-4); }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--color-ink);
    }
    input[type="text"] {
      width: 100%;
      min-height: var(--target);
      min-width: 0;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.92rem;
      font-family: inherit;
      background: var(--color-control);
      color: var(--color-ink);
      outline: none;
      transition: border-color var(--dur-short) var(--ease-out), background var(--dur-short) var(--ease-out), box-shadow var(--dur-short) var(--ease-out);
    }
    input[type="text"]::placeholder { color: var(--color-subtle); opacity: 1; }
    @media (hover: hover) and (pointer: fine) {
      input[type="text"]:hover { background: var(--color-surface); }
    }
    input[type="text"]:focus {
      border-color: var(--color-accent);
      background: var(--color-surface);
    }
    input[type="text"]:focus-visible {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px oklch(52% 0.16 255 / 0.2);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: var(--target);
      min-width: var(--target);
      padding: 0.6rem 1.1rem;
      border-radius: 0;
      font-size: 0.9rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      white-space: nowrap;
      transition:
        background var(--dur-short) var(--ease-out),
        border-color var(--dur-short) var(--ease-out),
        color var(--dur-short) var(--ease-out),
        transform var(--dur-press) var(--ease-out),
        opacity var(--dur-short) var(--ease-out);
    }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary {
      background: var(--color-ink);
      color: var(--color-surface);
    }
    .btn-secondary {
      background: var(--color-surface);
      color: var(--color-ink);
      border-color: var(--color-border-strong);
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover:not(:disabled) {
        background: oklch(28% 0.02 255);
      }
      .btn-secondary:hover:not(:disabled) {
        background: var(--color-control);
        border-color: var(--color-muted);
      }
    }

    .auth-result { margin-top: var(--space-4); }
    .auth-result.hidden { display: none; }
    .status-line {
      color: var(--color-muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }
    .error-box {
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.9rem;
      color: var(--color-danger);
      font-size: 0.88rem;
      line-height: 1.45;
    }
    .error-box a { color: var(--color-accent-ink); font-weight: 600; }

    .right-panel { position: sticky; top: var(--space-5); min-width: 0; }
    .summary-panel {
      min-height: 26rem;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .summary-panel-header {
      padding: 0.85rem var(--space-5);
      border-bottom: 1px solid var(--color-border);
      font-size: 0.88rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      background: var(--color-surface);
    }
    .summary-panel-header span:last-child {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--color-subtle);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-family: var(--font-mono);
    }
    .summary-panel-body {
      padding: var(--space-5);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .summary-placeholder {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      color: var(--color-subtle);
      font-size: 0.92rem;
      text-align: left;
      gap: 0.4rem;
      line-height: 1.5;
      max-width: 22rem;
    }
    .summary-placeholder-icon { display: none; }
    .summary-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.75rem;
      color: var(--color-muted);
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .spinner {
      width: 1.15rem;
      height: 1.15rem;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-ink);
      border-radius: 50%;
      animation: spin 0.55s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* Occasional panel state enter — opacity + small Y, never scale(0).
       Keyframes fire reliably when nodes are injected via JS. */
    .summary-enter {
      animation: summaryEnter var(--dur-med) var(--ease-out) both;
    }
    @keyframes summaryEnter {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .summary-panel-body[aria-busy="true"] {
      opacity: 0.92;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .btn:active:not(:disabled) { transform: none; }
      .spinner { animation: none; opacity: 0.75; }
      .summary-enter { animation: none; transform: none; }
      details.card-collapsible[open] .collapsible-body { animation: none; }
    }
    .summary-content { display: flex; flex-direction: column; gap: 0.85rem; min-width: 0; }
    .summary-meta { font-size: 0.8rem; color: var(--color-subtle); font-variant-numeric: tabular-nums; }
    .prs-list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .prs-list span {
      display: inline-block;
      background: var(--color-control);
      color: var(--color-ink);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.15rem 0.5rem;
      font-size: 0.76rem;
      font-weight: 500;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
    .summary-text {
      background: var(--color-control);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.95rem 1rem;
      font-size: 0.92rem;
      line-height: 1.65;
      white-space: pre-wrap;
      color: var(--color-ink);
      font-variant-numeric: tabular-nums;
      min-width: 0;
    }
    .summary-error {
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      border-radius: var(--radius-sm);
      padding: 0.85rem 1rem;
      color: var(--color-danger);
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .summary-error a { color: var(--color-accent-ink); font-weight: 600; }

    details.card-collapsible {
      padding: 0;
      overflow: hidden;
      margin-bottom: var(--space-3);
      box-shadow: none;
    }
    details.card-collapsible > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      min-height: var(--target);
      padding: 0.9rem var(--space-4);
      user-select: none;
    }
    details.card-collapsible > summary:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
      border-radius: var(--radius);
    }
    details.card-collapsible > summary::-webkit-details-marker { display: none; }
    details.card-collapsible > summary::marker { content: ''; }
    .collapsible-summary-text {
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
      min-width: 0;
    }
    .collapsible-summary-text strong {
      font-size: 0.92rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      font-style: normal;
    }
    .collapsible-summary-hint {
      font-size: 0.8rem;
      color: var(--color-muted);
      font-weight: 400;
    }
    .collapsible-chevron {
      flex-shrink: 0;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 0.55rem;
      color: var(--color-muted);
      background: var(--color-control);
      border: 1px solid var(--color-border);
      transition: transform var(--dur-short) var(--ease-out);
    }
    details.card-collapsible[open] .collapsible-chevron {
      transform: rotate(90deg);
    }
    .collapsible-body {
      padding: 0 var(--space-4) var(--space-4);
      border-top: 1px solid var(--color-border);
    }
    details.card-collapsible[open] .collapsible-body {
      animation: collapsibleIn var(--dur-short) var(--ease-out);
    }
    @keyframes collapsibleIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .collapsible-body .subtitle { margin-top: 0.85rem; margin-bottom: 0.7rem; }
    .help-list {
      font-size: 0.86rem;
      color: var(--color-muted);
      line-height: 1.55;
      padding-left: 1.1rem;
    }
    .help-list li { margin-bottom: 0.55rem; }
    .help-list li:last-child { margin-bottom: 0; }
    .help-list code {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      background: var(--color-control);
      border: 1px solid var(--color-border);
      padding: 0.06rem 0.3rem;
      border-radius: 4px;
      color: var(--color-ink);
    }
    .help-list a {
      color: var(--color-accent-ink);
      font-weight: 500;
      text-underline-offset: 0.18em;
    }
    .help-list a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: 3px;
    }

    .resource-links {
      margin-top: var(--space-6);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
      color: var(--color-subtle);
      font-size: 0.84rem;
      line-height: 1.6;
    }
    .resource-links strong {
      color: var(--color-muted);
      font-weight: 600;
      margin-right: 0.25rem;
    }
    .resource-links a {
      color: var(--color-accent-ink);
      font-weight: 500;
      text-decoration: none;
      text-underline-offset: 0.18em;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .resource-links a:hover { text-decoration: underline; }
    }
    .resource-links a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 3px;
      border-radius: 4px;
    }
    .resource-links-sep { color: var(--color-border-strong); margin: 0 0.35rem; user-select: none; }
  </style>
</head>
<body>
<div class="container">
  <header class="topbar">
    <div class="brand">
      <h1>GitHub PR Summarizer</h1>
      <p class="lede">Summarize the most-discussed open pull requests in any GitHub repository with a per-session connected account.</p>
      <p class="header-links">
        <a href="https://github.com/scalekit-developers/render-ai-agent-deploykit/blob/main/README.md" target="_blank" rel="noopener noreferrer">README</a>
        <span class="header-links-sep" aria-hidden="true">·</span>
        <a href="https://docs.scalekit.com/cookbooks/render-github-pr-summarizer/" target="_blank" rel="noopener noreferrer">Cookbook</a>
        <span class="header-links-sep" aria-hidden="true">·</span>
        <a href="https://docs.scalekit.com/" target="_blank" rel="noopener noreferrer">Docs</a>
        <span class="header-links-sep" aria-hidden="true">·</span>
        <a href="https://youtu.be/w3atzSkKE1w" target="_blank" rel="noopener noreferrer">Video</a>
      </p>
    </div>
  </header>

  ${connectedBanner}

  <details class="card-collapsible">
    <summary>
      <span class="collapsible-summary-text">
        <strong>Scalekit setup (required)</strong>
        <span class="collapsible-summary-hint">GitHub connector &amp; user verification</span>
      </span>
      <span class="collapsible-chevron" aria-hidden="true">&#9654;</span>
    </summary>
    <div class="collapsible-body">
      <p class="subtitle">Complete these steps in the <a href="https://app.scalekit.com" target="_blank" rel="noopener noreferrer">Scalekit dashboard</a> before using this app. Full order: Scalekit connector → GitHub OAuth callback → user verification → env vars → deploy.</p>
      <ul class="help-list">
        <li><strong>GitHub connector:</strong> Go to <strong>AgentKit → Connectors</strong>, add a <strong>GitHub</strong> connector, and copy the connection name into <code>GITHUB_CONNECTION_NAME</code>. In GitHub's OAuth App settings, set <strong>Authorization callback URL</strong> to the <strong>Redirect URI</strong> shown on the Scalekit connection — not this app's URL.</li>
        <li><strong>User verification (most common setup issue):</strong> Go to <a href="https://docs.scalekit.com/agentkit/user-verification/" target="_blank" rel="noopener noreferrer"><strong>AgentKit → Settings → User verification</strong></a> and choose a mode. Use <strong>Scalekit users only</strong> for development/testing. Use <strong>Custom user verification</strong> for production. <em>If you skip this step, the app will stay stuck on "Waiting for GitHub authorization" after OAuth completes.</em></li>
      </ul>
    </div>
  </details>

  <details class="card-collapsible" style="margin-bottom:1.15rem">
    <summary>
      <span class="collapsible-summary-text">
        <strong>Environment variables</strong>
        <span class="collapsible-summary-hint">Scalekit, OpenAI key scopes &amp; Render</span>
      </span>
      <span class="collapsible-chevron" aria-hidden="true">&#9654;</span>
    </summary>
    <div class="collapsible-body">
      <p class="subtitle">Configure these on Render (or in a local <code>.env</code> for development). See the README for least-privilege OpenAI key setup.</p>
      <ul class="help-list">
        <li><strong>Scalekit credentials:</strong> Dashboard → <strong>Developers → API Credentials</strong> for <code>SCALEKIT_ENVIRONMENT_URL</code>, <code>SCALEKIT_CLIENT_ID</code>, and <code>SCALEKIT_CLIENT_SECRET</code>.</li>
        <li><strong>LLM setup:</strong> Set <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> (default <code>gpt-4.1-mini</code>). Leave <code>OPENAI_BASE_URL</code> empty for OpenAI direct. For a proxy, set <code>OPENAI_BASE_URL</code> and use the proxy token as the key.</li>
        <li><strong>OpenAI key scope:</strong> Use a project key with <strong>Restricted</strong> permissions. This app only needs chat/model inference — leave Assistants, Fine-tuning, Files, etc. disabled.</li>
        <li><strong>Session security:</strong> Generate <code>SESSION_SECRET</code> with <code>openssl rand -hex 32</code>. On Render, <code>render.yaml</code> auto-generates this.</li>
        <li><strong>PUBLIC_BASE_URL (optional):</strong> Auto-detected from Render proxy headers. Only set for a custom domain or unusual reverse proxy.</li>
      </ul>
    </div>
  </details>

  <div class="layout">
    <div class="left-panel">
      <div class="card">
        <div class="card-head">
          <span class="step-pill ${connected ? "ready" : ""}">${authStep}</span>
          <h2>${authHeading}</h2>
        </div>
        <p class="subtitle">${authSubtitle}</p>
        <button id="auth-btn" class="${authButtonClass}" onclick="connectGitHub()">${authButtonLabel}</button>
        <div class="auth-result hidden" id="auth-result"></div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="step-pill">Step 2</span>
          <h2>Summarize pull requests</h2>
        </div>
        <p class="subtitle">Paste a GitHub repository URL or an <code>owner/repo</code> value. Public repositories work with any connected account. Private repositories require access.</p>
        <div class="field">
          <label for="sum-repository">GitHub repository</label>
          <input type="text" id="sum-repository" placeholder="https://github.com/render-oss/sdk" autocomplete="off">
        </div>
        <button id="sum-btn" class="btn btn-primary" onclick="summarize()">Summarize PRs</button>
      </div>
    </div>

    <div class="right-panel">
      <div class="summary-panel">
        <div class="summary-panel-header">
          <span>Summary</span>
          <span>Output</span>
        </div>
        <div class="summary-panel-body" id="summary-panel-body">
          <div class="summary-placeholder" id="summary-placeholder">
            <span>Connect GitHub, paste a repository, then click <strong>Summarize PRs</strong>.</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <p class="resource-links">
    <strong>Resources</strong>
    <a href="https://www.scalekit.com/" target="_blank" rel="noopener noreferrer">Scalekit</a>
    <span class="resource-links-sep" aria-hidden="true">·</span>
    <a href="https://docs.scalekit.com/" target="_blank" rel="noopener noreferrer">Docs</a>
    <span class="resource-links-sep" aria-hidden="true">·</span>
    <a href="https://docs.scalekit.com/agentkit/connectors/" target="_blank" rel="noopener noreferrer">Connectors</a>
    <span class="resource-links-sep" aria-hidden="true">·</span>
    <a href="https://docs.scalekit.com/agentkit/examples/" target="_blank" rel="noopener noreferrer">Examples</a>
    <span class="resource-links-sep" aria-hidden="true">·</span>
    <a href="https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit" target="_blank" rel="noopener noreferrer">Deploy to Render</a>
  </p>
</div>

<script>
  const RENDER_DEPLOY_URL = 'https://render.com/deploy?repo=https://github.com/scalekit-developers/render-ai-agent-deploykit';

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function mdToHtml(md) {
    return escHtml(md)
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  }

  function renderErrorHtml(message) {
    return escHtml(message)
      .replace(
        escHtml(RENDER_DEPLOY_URL),
        '<a href="' + RENDER_DEPLOY_URL + '" target="_blank" rel="noopener noreferrer">Deploy this on your own Render</a>',
      )
      .replace(
        'support@scalekit.com',
        '<a href="mailto:support@scalekit.com">support@scalekit.com</a>',
      );
  }

  let authPollTimer = null;

  function startAuthPoll() {
    if (authPollTimer) return;
    authPollTimer = setInterval(async () => {
      try {
        const r = await fetch('/api/auth/status');
        const d = await r.json();
        if (d.connected) {
          clearInterval(authPollTimer);
          authPollTimer = null;
          window.location.reload();
        }
      } catch {}
    }, 2500);
  }

  async function connectGitHub() {
    const resultEl = document.getElementById('auth-result');
    const btn = document.getElementById('auth-btn');

    btn.disabled = true;
    resultEl.className = 'auth-result';
    resultEl.innerHTML = '<p class="status-line">Generating authorization link…</p>';

    try {
      const res = await fetch('/api/auth', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      window.open(data.authLink, '_blank');
      resultEl.innerHTML = '<p class="status-line">Waiting for GitHub authorization… complete the flow in the new tab.</p>';
      startAuthPoll();
    } catch (err) {
      resultEl.innerHTML = \`<div class="error-box">\${renderErrorHtml(err.message)}</div>\`;
      btn.disabled = false;
    }
  }

  async function summarize() {
    const repository = document.getElementById('sum-repository').value.trim();
    const panelBody = document.getElementById('summary-panel-body');
    const btn = document.getElementById('sum-btn');
    if (!repository) { alert('Enter a GitHub repository URL or owner/repo value'); return; }

    btn.disabled = true;
    panelBody.setAttribute('aria-busy', 'true');
    panelBody.innerHTML = \`
      <div class="summary-loading summary-enter">
        <div class="spinner" aria-hidden="true"></div>
        <span>Fetching PRs and generating summaries…<br><span style="font-size:0.8rem;color:var(--color-subtle)">This may take up to 2 minutes.</span></span>
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
        <div class="summary-content summary-enter">
          <div class="summary-meta">\${escHtml(data.repository)} &middot; top \${data.prsAnalyzed?.length ?? 0} PRs by discussion</div>
          \${prsHtml}
          <div class="summary-text">\${mdToHtml(data.summary)}</div>
        </div>\`;
    } catch (err) {
      panelBody.innerHTML = \`<div class="summary-error summary-enter">\${renderErrorHtml(err.message)}</div>\`;
    } finally {
      panelBody.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}
