// Pure helpers for the local .env file. They never print values: secrets must not
// reach a terminal, a log or a GitHub message (AGENTS.md section 3).

// Accepts `KEY=value`, `KEY = value`, `export KEY=value`, a trailing `# comment` and CRLF.
const LINE = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*([^#\r\n]*?)\s*(#[^\r\n]*)?\r?$/;

/** Value of `key` in an .env content, "" when the key is present but empty, undefined when absent. */
export function readEnvValue(content: string, key: string): string | undefined {
  for (const line of content.split("\n")) {
    const m = LINE.exec(line);
    if (m && m[1] === key) return m[2]!;
  }
  return undefined;
}

/**
 * Sets each key of `values` only where its line exists and is empty, keeping the
 * trailing comment. Existing values are never overwritten. Missing keys are appended.
 * Throws if a line mentions one of the keys without being parseable, rather than
 * appending a second, conflicting definition.
 * Returns the new content and the keys actually written.
 */
export function fillEmptyEnv(content: string, values: Record<string, string>): { content: string; written: string[] } {
  const written: string[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n").map((line) => {
    const m = LINE.exec(line);
    if (!m) {
      const mentioned = Object.keys(values).find((key) => !line.trimStart().startsWith("#") && line.includes(key));
      if (mentioned) throw new Error(`.env: cannot parse the line that defines ${mentioned}; fix it by hand`);
      return line;
    }
    const key = m[1]!;
    seen.add(key);
    if (!(key in values) || m[2] !== "") return line;
    written.push(key);
    const comment = m[3] ? `   ${m[3]}` : "";
    return `${key}=${values[key]}${comment}${line.endsWith("\r") ? "\r" : ""}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key)) continue;
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    lines.push(`${key}=${value}`, "");
    written.push(key);
  }
  return { content: lines.join("\n"), written };
}
