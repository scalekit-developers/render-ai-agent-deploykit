import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "sid";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required. Generate one with: openssl rand -hex 32");
  return s;
}

interface SessionEntry {
  identifier: string;
  pendingState?: string;
  pendingStateExpiresAt?: number;
  connectedAt?: number;
}

// In-memory store — suitable for a single-instance sample.
// Replace with Redis or a database-backed store in production.
const store = new Map<string, SessionEntry>();

export function assertSessionSecretConfigured(): void {
  void getSecret();
}

function sign(sessionId: string): string {
  const mac = createHmac("sha256", getSecret()).update(sessionId).digest("base64url");
  return `${sessionId}.${mac}`;
}

function unsign(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const sessionId = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = createHmac("sha256", getSecret()).update(sessionId).digest("base64url");
  // timingSafeEqual guards against timing attacks on the HMAC comparison.
  const expectedBuf = Buffer.from(expected);
  const macBuf = Buffer.from(mac);
  if (expectedBuf.length !== macBuf.length) return null;
  return timingSafeEqual(expectedBuf, macBuf) ? sessionId : null;
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return [];
      try {
        return [[pair.slice(0, eq).trim(), decodeURIComponent(pair.slice(eq + 1).trim())]];
      } catch {
        return [];
      }
    }),
  );
}

export interface Session {
  sessionId: string;
  entry: SessionEntry;
}

/**
 * Read-or-create the session for this request and set (or refresh) the session cookie.
 * Always call this before accessing session state in a route.
 */
export function requireSession(req: Request, res: Response): Session {
  const cookies = parseCookieHeader(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  let sessionId = raw ? unsign(raw) : null;
  let entry = sessionId ? store.get(sessionId) ?? null : null;

  if (!sessionId || !entry) {
    sessionId = randomBytes(32).toString("base64url");
    entry = { identifier: "" };
    store.set(sessionId, entry);
  }

  // The cookie payload is already a random opaque session id. HMAC signing is
  // enough to detect tampering; encrypting the cookie would not add meaningful
  // protection for this sample because there is no sensitive plaintext inside it.
  const protoHeader = req.get("x-forwarded-proto");
  const requestIsSecure = req.secure || protoHeader?.split(",")[0]?.trim() === "https";
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.PUBLIC_BASE_URL?.startsWith("https://") === true ||
    requestIsSecure;
  const parts = [
    `${COOKIE_NAME}=${sign(sessionId)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));

  return { sessionId, entry };
}

/** Mint a stable opaque identifier for a session. Returns the same value on repeat calls. */
export function mintIdentifier(entry: SessionEntry): string {
  if (!entry.identifier) {
    entry.identifier = `usr_${randomBytes(16).toString("hex")}`;
  }
  return entry.identifier;
}

/** Store a single-use CSRF state value in the session, valid for STATE_TTL_MS. */
export function setPendingState(entry: SessionEntry, state: string): void {
  entry.pendingState = state;
  entry.pendingStateExpiresAt = Date.now() + STATE_TTL_MS;
}

/**
 * Validate and consume the pending state. Returns false if missing, expired, or mismatched.
 * Single-use: clears the stored state even on failure.
 */
export function consumePendingState(entry: SessionEntry, incoming: string): boolean {
  const stored = entry.pendingState;
  const expiresAt = entry.pendingStateExpiresAt;
  entry.pendingState = undefined;
  entry.pendingStateExpiresAt = undefined;

  if (!stored || !expiresAt || Date.now() > expiresAt) return false;

  const storedBuf = Buffer.from(stored);
  const incomingBuf = Buffer.from(incoming);
  if (storedBuf.length !== incomingBuf.length) return false;
  return timingSafeEqual(storedBuf, incomingBuf);
}

/** Mark the session as having a connected GitHub account. */
export function markConnected(entry: SessionEntry): void {
  entry.connectedAt = Date.now();
}

export function isConnected(entry: SessionEntry): boolean {
  return entry.connectedAt !== undefined;
}
