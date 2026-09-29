
export type EnvEntry = { key: string; value: string };

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };

/** Index of the closing quote in `s`, skipping backslash-escaped ones for double quotes. */
function findClosingQuote(s: string, quote: string): number {
  for (let i = 0; i < s.length; i++) {
    if (quote === '"' && s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === quote) return i;
  }
  return -1;
}

export function parseDotenv(text: string): { entries: EnvEntry[]; errors: string[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result = new Map<string, string>();
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();

    const eq = line.indexOf("=");
    if (eq <= 0) {
      errors.push(`Line ${lineNo}: expected KEY=VALUE`);
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quote = value[0];

    if (quote === '"' || quote === "'" || quote === "`") {
      let rest = value.slice(1);
      let end = findClosingQuote(rest, quote);
      while (end === -1 && i + 1 < lines.length) {
        i++;
        rest += "\n" + lines[i];
        end = findClosingQuote(rest, quote);
      }
      if (end === -1) {
        errors.push(`Line ${lineNo}: unterminated quoted value for ${key}`);
        continue;
      }
      value = rest.slice(0, end);
      if (quote === '"') value = value.replace(/\\([nrt"\\])/g, (_, c: string) => ESCAPES[c]);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }

    result.set(key, value);
  }

  return { entries: [...result].map(([key, value]) => ({ key, value })), errors };
}

export function serializeDotenv(entries: EnvEntry[]): string {
  return entries
    .map(({ key, value }) => {
      const needsQuotes = /[\s#"'`\\]/.test(value);
      if (!needsQuotes) return `${key}=${value}`;
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
      return `${key}="${escaped}"`;
    })
    .join("\n");
}
