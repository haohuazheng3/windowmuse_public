/*
 * Automatic internal links for article bodies (a rehype plugin, pure so it is unit-testable).
 * The first occurrence of each known phrase in running text becomes a link to its article,
 * hub or product page. Never inside headings, links, code or figure captions; never a link
 * to the page itself; one link per phrase and per destination; at most `max` links per article.
 */

export type HastText = { type: "text"; value: string };
export type HastElement = { type: "element"; tagName: string; properties?: Record<string, unknown>; children: HastNode[] };
export type HastNode = HastText | HastElement | { type: string; children?: HastNode[]; value?: string };

export interface AutolinkOptions {
  terms: { phrase: string; href: string }[];
  /** URL of the page being rendered: links back to it are skipped. */
  self?: string;
  /** Upper bound on links added to one article. */
  max?: number;
}

const SKIP_TAGS = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "figcaption", "button", "summary"]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasChildren(node: HastNode): node is HastElement | { type: string; children: HastNode[] } {
  return Array.isArray((node as { children?: unknown }).children);
}

export function rehypeAutolink(options: AutolinkOptions) {
  const max = options.max ?? 5;
  const terms = options.terms
    .filter((t) => t.phrase.trim().length > 0 && t.href !== options.self)
    .sort((a, b) => b.phrase.length - a.phrase.length);

  return (tree: HastNode) => {
    const usedHref = new Set<string>();
    const usedPhrase = new Set<string>();
    let added = 0;

    const walk = (node: HastNode, inSkip: boolean) => {
      if (added >= max || !hasChildren(node)) return;
      const skip = inSkip || (node.type === "element" && SKIP_TAGS.has((node as HastElement).tagName));
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        if (added >= max) return;
        const child = children[i];
        if (child.type !== "text") {
          walk(child, skip);
          continue;
        }
        if (skip) continue;
        const text = (child as HastText).value;
        for (const t of terms) {
          const key = t.phrase.toLowerCase();
          if (usedHref.has(t.href) || usedPhrase.has(key)) continue;
          const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(t.phrase)})(?![\\p{L}\\p{N}])`, "iu");
          const m = re.exec(text);
          if (!m) continue;
          const start = m.index + m[1].length;
          const matched = m[2];
          const before = text.slice(0, start);
          const after = text.slice(start + matched.length);
          const link: HastElement = {
            type: "element",
            tagName: "a",
            properties: { href: t.href, "data-autolink": "true" },
            children: [{ type: "text", value: matched }],
          };
          const replacement: HastNode[] = [];
          if (before) replacement.push({ type: "text", value: before });
          replacement.push(link);
          if (after) replacement.push({ type: "text", value: after });
          children.splice(i, 1, ...replacement);
          // Rescan the text before the link (a shorter phrase may sit there), then the link is skipped
          // as an <a>, and the text after it is scanned in turn: step back so the loop's i++ lands on `before`.
          if (before) i -= 1;
          usedHref.add(t.href);
          usedPhrase.add(key);
          added++;
          break;
        }
      }
    };

    walk(tree, false);
  };
}
