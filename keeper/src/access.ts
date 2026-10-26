// Server-side authorization of the routes that spend or move anything (hosted keeper).
// A token is a secret known to the team and set only on the host (KEEPER_ACCESS_TOKENS): it never
// reaches the web bundle. CORS and the Host/Origin checks stop other web pages, not other programs.
import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_TOKEN_LENGTH = 32;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Parses KEEPER_ACCESS_TOKENS (comma separated, one per teammate so that one can be revoked alone). */
export function parseAccessTokens(raw: string | undefined): string[] {
  const tokens = (raw ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  for (const t of tokens) {
    if (t.length < MIN_TOKEN_LENGTH) throw new Error(`Each KEEPER_ACCESS_TOKENS entry must have at least ${MIN_TOKEN_LENGTH} characters (use \`openssl rand -hex 24\`)`);
  }
  return tokens;
}

/** Constant-time check of an `Authorization: Bearer <token>` header against the accepted tokens. */
export function makeAuthorizer(tokens: string[]): (header: string | undefined) => boolean {
  const accepted = tokens.map(digest);
  return (header) => {
    const m = /^Bearer (\S+)$/.exec(header ?? "");
    if (!m) return false;
    const given = digest(m[1]!);
    // Every token is compared, whatever the outcome, so the time taken does not tell which one matched.
    return accepted.map((a) => timingSafeEqual(a, given)).reduce((any, ok) => any || ok, false);
  };
}

/** `https://keystone-*-team.vercel.app` matches any single DNS label in place of `*`; other entries are exact. */
export function originMatcher(patterns: string[]): (origin: string) => boolean {
  const rules = patterns.map((p) => {
    if (!p.includes("*")) return (o: string) => o === p;
    const re = new RegExp("^" + p.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]+") + "$");
    return (o: string) => re.test(o);
  });
  return (origin) => rules.some((r) => r(origin));
}
