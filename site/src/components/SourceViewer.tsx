import { useEffect, useMemo, useState } from 'preact/hooks';
import { Marked } from 'marked';

// Renders an artifact's files (mirrored into /source/ by scripts/build-catalog.mjs) inside the
// site. Plugin files may come from outside contributors, so raw HTML in markdown is shown as
// text, images become their alt text, and only http(s) and relative links survive.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const md = new Marked({
  gfm: true,
  renderer: {
    html({ text }) { return esc(text); },
    image({ text }) { return esc(text); },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (/^https?:\/\//i.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return label; // javascript:, data:, mailto: …
      if (href.startsWith('#')) return label; // in-page anchors: headings carry no ids here
      return `<a href="#" data-rel="${esc(href)}">${label}</a>`;
    },
  },
});

function splitFrontmatter(text: string): { fm: [string, string][]; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: [], body: text };
  const fm: [string, string][] = [];
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) fm.push([kv[1], kv[2].replace(/^"(.*)"$/, '$1')]);
    else if (fm.length && line.trim()) fm[fm.length - 1][1] += (fm[fm.length - 1][1] ? '\n' : '') + line.trim();
  }
  return { fm, body: m[2] };
}

// "a/b/../c.md" relative to "plugins/x/skills/y/SKILL.md" → "plugins/x/skills/y/c.md"
function resolvePath(from: string, rel: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of rel.split('#')[0].split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

interface Props {
  files: string[]; base: string; githubUrl: (path: string) => string;
  labels: { files: string; github: string; loading: string; error: string };
}

export function SourceViewer({ files, base, githubUrl, labels }: Props) {
  const [sel, setSel] = useState(files[0]);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setSel(files[0]), [files]);
  useEffect(() => {
    let live = true;
    setText(null); setFailed(false);
    fetch(`${base}source/${sel}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((t) => live && setText(t))
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [sel, base]);

  // Shared directory of the artifact's files, so the list shows short names.
  const root = useMemo(() => {
    const dirs = files.map((f) => f.split('/').slice(0, -1));
    const first = dirs[0] ?? [];
    let n = first.length;
    for (const d of dirs) { let i = 0; while (i < n && d[i] === first[i]) i++; n = i; }
    return first.slice(0, n).join('/');
  }, [files]);
  const short = (f: string) => (root ? f.slice(root.length + 1) : f);

  const isMd = /\.md$/i.test(sel);
  const parsed = useMemo(() => (text !== null && isMd ? splitFrontmatter(text) : null), [text, isMd]);
  const html = useMemo(() => (parsed ? (md.parse(parsed.body) as string) : ''), [parsed]);

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[data-rel]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const target = resolvePath(sel, a.dataset.rel!);
    if (files.includes(target)) setSel(target);
    else window.open(githubUrl(target), '_blank', 'noopener');
  };

  return (
    <div class="src">
      {files.length > 1 && (
        <div class="src-files" role="tablist" aria-label={labels.files}>
          {files.map((f) => (
            <button role="tab" aria-selected={f === sel} class="src-file" key={f} onClick={() => setSel(f)} title={f}>{short(f)}</button>
          ))}
        </div>
      )}
      <div class="src-bar">
        <span class="mono">{short(sel) || sel}</span>
        <a href={githubUrl(sel)} target="_blank" rel="noopener noreferrer">{labels.github} ↗</a>
      </div>
      {failed ? <p class="muted">{labels.error}</p>
        : text === null ? <p class="muted">{labels.loading}</p>
        : parsed ? (
          <div class="md" onClick={onClick}>
            {parsed.fm.length > 0 && (
              <table class="fm"><tbody>{parsed.fm.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
            )}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : <pre class="code"><code>{text}</code></pre>}
    </div>
  );
}
