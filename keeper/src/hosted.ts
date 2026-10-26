// Start-up rules of a keeper that listens beyond loopback (and is therefore reachable by anyone).
import { parseAccessTokens } from "./access.ts";

export interface Exposure {
  host: string;
  hosted: boolean;
  accessTokens: string[];
}

/** Reads KEEPER_HOST and the hosted-only variables; throws when a public keeper is not locked down. */
export function readExposure(env: Record<string, string | undefined>, signer: string): Exposure {
  const host = env.KEEPER_HOST || "127.0.0.1";
  const hosted = !["127.0.0.1", "localhost", "::1"].includes(host);
  const accessTokens = parseAccessTokens(env.KEEPER_ACCESS_TOKENS);
  if (hosted) {
    if (signer !== "freighter") throw new Error("A hosted keeper must run with SIGNER=freighter: it never holds the fund key");
    if (accessTokens.length === 0) throw new Error("A hosted keeper needs KEEPER_ACCESS_TOKENS: its write routes cost fees and move collateral");
    if (!env.KEEPER_ALLOWED_ORIGINS) throw new Error("A hosted keeper needs KEEPER_ALLOWED_ORIGINS (the exact origin of the web app)");
    if (!env.KEEPER_PUBLIC_HOSTS) throw new Error("A hosted keeper needs KEEPER_PUBLIC_HOSTS (its own public host name)");
    const local = /^https?:\/\/(localhost|127\.|\[::1\])/i;
    if ((env.KEEPER_ALLOWED_ORIGINS ?? "").split(",").some((o) => local.test(o.trim()))) {
      throw new Error("KEEPER_ALLOWED_ORIGINS must not list localhost on a hosted keeper: any page on a visitor's machine could then call it");
    }
    if (env.FUND_SECRET) throw new Error("FUND_SECRET must not be set on a hosted keeper");
  }
  return { host, hosted, accessTokens };
}
