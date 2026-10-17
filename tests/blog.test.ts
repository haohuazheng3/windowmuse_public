import { describe, expect, it } from "vitest";
import { allPostsIncludingDrafts, autolinkTerms, countWords, extractHeadings, getPost, isLive, parsePost, publishedPosts, relatedPosts, toolRoutes } from "@/lib/blog";
import { rehypeAutolink, type HastElement } from "@/lib/autolink";
import { CATEGORIES } from "@/content/categories";

describe("blog pipeline", () => {
  it("extracts H2 headings with GitHub-style ids and skips code fences", () => {
    expect(extractHeadings("intro\n## What it means\ntext\n```\n## not a heading\n```\n## What to do next?\n### sub")).toEqual([
      { id: "what-it-means", text: "What it means" },
      { id: "what-to-do-next", text: "What to do next?" },
    ]);
  });

  it("counts visible words, not JSX, props or code", () => {
    const body = 'Two words.\n\n<Steps title="x" items={[{ title: "a b c", text: "d e" }]} />\n\n```\nnot counted here\n```\n\n**three more words**';
    expect(countWords(body)).toBe(5);
  });

  it("gates drafts and future posts", () => {
    expect(isLive({ draft: true, publishedAt: "2020-01-01" }, "2026-10-09")).toBe(false);
    expect(isLive({ draft: false, publishedAt: "2026-10-10" }, "2026-10-09")).toBe(false);
    expect(isLive({ draft: false, publishedAt: "2026-10-09" }, "2026-10-09")).toBe(true);
  });

  it("loads the template as a draft that is never public", () => {
    const tpl = getPost("ai-video", "article-template", { includeDrafts: true });
    expect(tpl).not.toBeNull();
    expect(tpl?.draft).toBe(true);
    expect(tpl?.faq.length).toBeGreaterThanOrEqual(3);
    expect(tpl?.headings.length).toBeGreaterThanOrEqual(3);
    expect(tpl?.wordCount).toBeGreaterThan(300);
    expect(getPost("ai-video", "article-template")).toBeNull();
    expect(publishedPosts().some((p) => p.slug === "article-template")).toBe(false);
  });

  it("reads the tool-first frontmatter: tool, level and images", () => {
    const raw = [
      "---",
      'title: "Hook generator"',
      'description: "d"',
      "publishedAt: 2026-11-01",
      "tool: hook-generator",
      "level: A",
      "images:",
      '  - { src: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg", alt: "A bottle", credit: "Jane", creditUrl: "https://www.pexels.com/@jane", width: 1880, height: 1300 }',
      '  - { alt: "no src, dropped" }',
      "---",
      "Body.",
    ].join("\n");
    const p = parsePost("product-videos", "hook-generator", "mdx", raw);
    expect(p.tool).toBe("hook-generator");
    expect(p.level).toBe("A");
    expect(p.images).toEqual([{ src: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg", alt: "A bottle", credit: "Jane", creditUrl: "https://www.pexels.com/@jane", width: 1880, height: 1300 }]);
    expect(p.image).toBeNull();
    const plain = parsePost("product-videos", "x", "md", "---\ntitle: x\n---\nhi");
    expect(plain).toMatchObject({ tool: null, level: "B", images: [] });
    expect(parsePost("product-videos", "x", "md", "---\ntitle: x\nlevel: C\ntool: ''\n---\nhi")).toMatchObject({ tool: null, level: "B" });
  });

  it("maps tool ids to the public page that hosts them", () => {
    const routes = toolRoutes();
    for (const [id, href] of Object.entries(routes)) {
      const post = publishedPosts().find((p) => p.tool === id);
      expect(post && `/blog/${post.category}/${post.slug}`).toBe(href);
    }
    expect(Object.keys(toolRoutes({ includeDrafts: true })).length).toBeGreaterThanOrEqual(Object.keys(routes).length);
  });

  it("only knows the categories in src/content/categories.ts", () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const p of allPostsIncludingDrafts()) {
      expect(slugs.has(p.category)).toBe(true);
      expect(p.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.updatedAt >= p.publishedAt).toBe(true);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("never relates a post to itself", () => {
    for (const p of publishedPosts()) {
      for (const r of relatedPosts(p)) expect(r.category === p.category && r.slug === p.slug).toBe(false);
    }
  });

  it("offers product-page autolink terms and hub names only for hubs with articles", () => {
    const terms = autolinkTerms();
    expect(terms.some((t) => t.href === "/presenters")).toBe(true);
    const live = publishedPosts();
    for (const c of CATEGORIES) {
      const linked = terms.some((t) => t.href === `/blog/${c.slug}`);
      expect(linked).toBe(live.some((p) => p.category === c.slug));
    }
  });
});

function p(text: string): HastElement {
  return { type: "element", tagName: "p", children: [{ type: "text", value: text }] };
}

function tree(...children: HastElement[]): HastElement {
  return { type: "element", tagName: "div", children };
}

function html(node: HastElement | { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === "text") return String(node.value);
  const el = node as HastElement;
  const attrs = el.properties?.href ? ` href="${String(el.properties.href)}"` : "";
  return `<${el.tagName}${attrs}>${el.children.map((c) => html(c as HastElement)).join("")}</${el.tagName}>`;
}

describe("rehypeAutolink", () => {
  const terms = [
    { phrase: "free trial", href: "/pricing" },
    { phrase: "presenter catalog", href: "/presenters" },
    { phrase: "shoppable video", href: "/blog/tiktok-shop/shoppable-video" },
  ];

  it("links the first occurrence only, keeps surrounding text, and respects word boundaries", () => {
    const t = tree(p("Start a free trial, then a free trial again. Freelancers."));
    rehypeAutolink({ terms })(t);
    expect(html(t)).toBe('<div><p>Start a <a href="/pricing">free trial</a>, then a free trial again. Freelancers.</p></div>');
  });

  it("links several phrases in one text node, whichever order they appear in", () => {
    const t = tree(p("The presenter catalog and the free trial."));
    rehypeAutolink({ terms })(t);
    expect(html(t)).toBe('<div><p>The <a href="/presenters">presenter catalog</a> and the <a href="/pricing">free trial</a>.</p></div>');
    // The longer phrase is matched first; the shorter one before it must still be found.
    const u = tree(p("A free trial, then the presenter catalog, then a shoppable video."));
    rehypeAutolink({ terms })(u);
    expect(html(u)).toBe(
      '<div><p>A <a href="/pricing">free trial</a>, then the <a href="/presenters">presenter catalog</a>, then a <a href="/blog/tiktok-shop/shoppable-video">shoppable video</a>.</p></div>',
    );
  });

  it("never links inside headings, links or code, and never to the page itself", () => {
    const t = tree(
      { type: "element", tagName: "h2", children: [{ type: "text", value: "free trial" }] },
      { type: "element", tagName: "a", properties: { href: "/x" }, children: [{ type: "text", value: "free trial" }] },
      { type: "element", tagName: "code", children: [{ type: "text", value: "free trial" }] },
      p("A shoppable video here."),
    );
    rehypeAutolink({ terms, self: "/blog/tiktok-shop/shoppable-video" })(t);
    expect(html(t)).toBe('<div><h2>free trial</h2><a href="/x">free trial</a><code>free trial</code><p>A shoppable video here.</p></div>');
  });

  it("stops at the maximum", () => {
    const t = tree(p("free trial"), p("presenter catalog"), p("shoppable video"));
    rehypeAutolink({ terms, max: 2 })(t);
    expect(html(t)).toBe('<div><p><a href="/pricing">free trial</a></p><p><a href="/presenters">presenter catalog</a></p><p>shoppable video</p></div>');
  });
});

describe("rehypeAutolink inside MDX components", () => {
  const terms = [{ phrase: "free trial", href: "/pricing" }];

  it("never adds a link inside <ToolLink> or <DataPoint> (they already render an anchor)", () => {
    const jsx = (name: string) => ({ type: "mdxJsxTextElement", name, attributes: [], children: [{ type: "text", value: "the free trial" }] });
    const tree: HastElement = { type: "element", tagName: "div", children: [{ type: "element", tagName: "p", children: [jsx("ToolLink"), { type: "text", value: " and " }, jsx("DataPoint")] }] };
    rehypeAutolink({ terms })(tree);
    const p = tree.children[0] as HastElement;
    for (const i of [0, 2]) {
      const node = p.children[i] as { children: { type: string }[] };
      expect(node.children).toHaveLength(1);
      expect(node.children[0].type).toBe("text");
    }
  });

  it("still links the same phrase in ordinary text next to such a component", () => {
    const jsx = { type: "mdxJsxTextElement", name: "ToolLink", attributes: [], children: [{ type: "text", value: "free trial" }] };
    const tree: HastElement = { type: "element", tagName: "div", children: [{ type: "element", tagName: "p", children: [jsx, { type: "text", value: " or a free trial." }] }] };
    rehypeAutolink({ terms })(tree);
    const p = tree.children[0] as HastElement;
    expect(p.children.map((c) => c.type)).toEqual(["mdxJsxTextElement", "text", "element", "text"]);
    expect((p.children[2] as HastElement).tagName).toBe("a");
  });
});
