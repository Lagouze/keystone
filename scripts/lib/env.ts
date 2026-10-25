// Pure helpers for the local .env file. They never print values: secrets must not
// reach a terminal, a log or a GitHub message (AGENTS.md section 3).

const LINE = /^([A-Z0-9_]+)=([^#\n]*?)(\s*#.*)?$/;

/** Value of `key` in an .env content, "" when the key is present but empty, undefined when absent. */
export function readEnvValue(content: string, key: string): string | undefined {
  for (const line of content.split("\n")) {
    const m = LINE.exec(line);
    if (m && m[1] === key) return m[2]!.trim();
  }
  return undefined;
}

/**
 * Sets each key of `values` only where its line exists and is empty, keeping the
 * trailing comment. Existing values are never overwritten. Missing keys are appended.
 * Returns the new content and the keys actually written.
 */
export function fillEmptyEnv(content: string, values: Record<string, string>): { content: string; written: string[] } {
  const written: string[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n").map((line) => {
    const m = LINE.exec(line);
    if (!m) return line;
    const key = m[1]!;
    seen.add(key);
    if (!(key in values) || m[2]!.trim() !== "") return line;
    written.push(key);
    const comment = m[3] ? `   ${m[3].trim()}` : "";
    return `${key}=${values[key]}${comment}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key)) continue;
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    lines.push(`${key}=${value}`, "");
    written.push(key);
  }
  return { content: lines.join("\n"), written };
}
