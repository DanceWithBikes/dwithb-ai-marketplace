import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import en from '../i18n/en.json';
import uk from '../i18n/uk.json';
import {
  search, installScript, installSnippet, wizardRank,
  type Catalog, type WizardStep, type WizardAnswers, type Plugin, type Artifact,
} from '../lib/catalog';

type Strings = typeof en;
const STR: Record<string, Strings> = { en, uk };
type View = 'browse' | 'compare' | 'wizard';
const TYPES = ['all', 'plugin', 'skill', 'agent', 'hook', 'mcp'];
const VIEWS: View[] = ['browse', 'compare', 'wizard'];

const fill = (t: string, n: number) => t.replace('{n}', String(n));
// Changelog items use `code` spans; render them without pulling in a markdown parser.
const inline = (t: string) => t.split('`').map((x, i) => (i % 2 ? <code key={i}>{x}</code> : x));

function readUrl() {
  const p = new URLSearchParams(location.search);
  const sort = p.get('sort');
  return {
    q: p.get('q') ?? '',
    type: p.get('type') ?? 'all',
    sort: (sort === 'az' || sort === 'new' ? sort : 'rel') as 'rel' | 'az' | 'new',
    basket: (p.get('basket') ?? '').split(',').filter(Boolean),
    item: p.get('item'),
  };
}

function loadLang(): string {
  try { const l = localStorage.getItem('lang'); if (l && STR[l]) return l; } catch { /* storage unavailable */ }
  return 'en';
}

function loadTheme(): 'dark' | 'light' {
  try { if (localStorage.getItem('theme') === 'light') return 'light'; } catch { /* storage unavailable */ }
  return 'dark';
}

export default function App({ base }: { base: string }) {
  const init = useMemo(readUrl, []);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [wiz, setWiz] = useState<WizardStep[]>([]);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState(loadLang);
  const [theme, setTheme] = useState(loadTheme);
  const [view, setView] = useState<View>('browse');
  const [q, setQ] = useState(init.q);
  const [type, setType] = useState(init.type);
  const [sort, setSort] = useState(init.sort);
  const [hooksOnly, setHooksOnly] = useState(false);
  const [basket, setBasket] = useState<string[]>(init.basket);
  const [cmp, setCmp] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [detail, setDetail] = useState<string | null>(init.item);
  const [copied, setCopied] = useState('');
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<WizardAnswers>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const qRef = useRef<HTMLInputElement>(null);
  const s = STR[lang];

  const load = () => {
    setError(false);
    Promise.all([
      fetch(`${base}catalog.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${base}wizard.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    ]).then(([c, w]: [Catalog, WizardStep[]]) => {
      setCat(c); setWiz(w);
      const known = new Set(c.plugins.map((p) => p.id));
      const unknown = init.basket.filter((id) => !known.has(id));
      setIgnored(unknown);
      setBasket((b) => b.filter((id) => known.has(id)));
    }).catch(() => setError(true));
  };
  useEffect(load, []);

  useEffect(() => { document.documentElement.lang = lang; try { localStorage.setItem('lang', lang); } catch { /* ignore */ } }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('theme', theme); } catch { /* ignore */ } }, [theme]);

  // URL state: shareable ?q=&type=&sort=&basket=
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (type !== 'all') p.set('type', type);
    if (sort !== 'rel') p.set('sort', sort);
    if (basket.length) p.set('basket', basket.join(','));
    if (detail) p.set('item', detail);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
  }, [q, type, sort, basket, detail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (e.key === '/' && t !== 'INPUT' && t !== 'SELECT') { e.preventDefault(); qRef.current?.focus(); }
      if (e.key === 'Escape') {
        if (detail) setDetail(null);
        else if (drawer) setDrawer(false);
        else if (t === 'INPUT') { setQ(''); (e.target as HTMLElement).blur(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, detail]);

  const results = useMemo(() => (cat ? search(cat, { q, type, hooksOnly, sort }) : []), [cat, q, type, hooksOnly, sort]);

  const flash = (k: string) => { setCopied(k); setTimeout(() => setCopied(''), 1400); };
  const clip = async (text: string, k: string) => {
    try { await navigator.clipboard.writeText(text); flash(k); }
    catch { window.prompt('Copy:', text); }
  };
  const addPlugin = (id: string) => { setBasket((b) => (b.includes(id) ? b : [...b, id])); setDetail(null); setDrawer(true); };
  const clearAll = () => { setQ(''); setType('all'); setHooksOnly(false); };
  const toggleCmp = (id: string) => setCmp((c) => (c.includes(id) ? c.filter((i) => i !== id) : c.length < 3 ? [...c, id] : c));
  const typeLabel = (t: string) => (t === 'all' ? s.all : t);

  const script = cat ? installScript(cat, basket) : '';
  const downloadScript = () => {
    const u = URL.createObjectURL(new Blob([`#!/bin/sh\n${script}\n`], { type: 'text/x-shellscript' }));
    const a = document.createElement('a'); a.href = u; a.download = 'install.sh'; a.click(); URL.revokeObjectURL(u);
  };

  const chrome = (body: preact.ComponentChildren) => (
    <div class="app">
      <header class="hdr">
        <div class="brand">dwithb <em>marketplace</em></div>
        <nav class="nav-tabs">
          {VIEWS.map((v, i) => (
            <button class="tab" aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>{s.tabs[i]}</button>
          ))}
        </nav>
        <div class="seg2" role="group" aria-label="Language">
          {['en', 'uk'].map((c) => <button aria-pressed={lang === c} onClick={() => setLang(c)}>{c.toUpperCase()}</button>)}
        </div>
        <div class="seg2" role="group" aria-label={s.theme.label}>
          {(['dark', 'light'] as const).map((t) => <button aria-pressed={theme === t} onClick={() => setTheme(t)}>{s.theme[t]}</button>)}
        </div>
        <button class="btn btn-secondary" onClick={() => setDrawer(true)}>{s.basket} · {basket.length}</button>
      </header>
      {body}
      <footer class="ftr">
        <span>{s.privacy}</span>
        <a href={`${base}catalog.json`}>catalog.json</a>
      </footer>
    </div>
  );

  if (error) return chrome(<main class="main"><div class="empty"><div class="big">{s.loadError}</div><div class="row"><button class="btn btn-secondary" onClick={load}>{s.retry}</button></div></div></main>);
  if (!cat) return chrome(<main class="main" aria-busy="true"><div class="grid">{[0, 1, 2].map((i) => <div class="skeleton" key={i} />)}<span class="sr-only">{s.loading}</span></div></main>);

  const plugin = (id: string) => cat.plugins.find((p) => p.id === id) as Plugin;

  // ---- browse ----
  const browse = (
    <main class="main">
      <div class="kicker">{s.kicker}</div>
      <h1 class="h-hero">{s.title}</h1>
      <div class="searchrow">
        <input ref={qRef} id="q" class="input" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder={s.ph} aria-label="Search" />
        <kbd>/</kbd>
      </div>
      <div class="filters">
        {TYPES.map((t) => <button class="chip" aria-pressed={type === t} onClick={() => setType(t)}>{typeLabel(t)}</button>)}
        <label class="check" style="margin-left:12px"><input type="checkbox" checked={hooksOnly} onChange={() => setHooksOnly(!hooksOnly)} /> {s.hasHooks}</label>
        <select class="select" value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)} aria-label="Sort">
          <option value="rel">{s.relevance}</option><option value="az">A–Z</option><option value="new">{s.recent}</option>
        </select>
      </div>
      <div class="count muted" aria-live="polite">{fill(s.count, results.length)}</div>
      {ignored.length > 0 && <p class="muted" role="status">Ignored unknown plugins in link: {ignored.join(', ')}</p>}
      {cat.artifacts.length === 0 ? (
        <div class="empty"><div class="big">{s.emptyCatalog}</div></div>
      ) : results.length > 0 ? (
        <div class="grid">
          {results.map((a) => {
            const p = plugin(a.plugin), inB = basket.includes(a.plugin);
            // The whole card opens the details; its own controls keep their behaviour.
            const open = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a, input, label, select')) setDetail(a.id); };
            return (
              <article class={`card rcard clickable${inB ? ' in-basket' : ''}`} key={a.id} onClick={open}>
                <div class="rcard-top">
                  <span class="tag tag-accent">{a.type}</span>
                  <label><input type="checkbox" checked={cmp.includes(a.id)} disabled={!cmp.includes(a.id) && cmp.length >= 3} onChange={() => toggleCmp(a.id)} /> {s.compare}</label>
                </div>
                <h3><button class="rcard-title" onClick={() => setDetail(a.id)}>{a.name}</button></h3>
                <div class="meta muted">{s.in} <a href="#" onClick={(e) => { e.preventDefault(); setQ(a.plugin); }}>{a.plugin}</a> · <span class="ver">v{p?.version}</span> · {p?.updatedAt}</div>
                <p class="desc">{a.description}</p>
                <div class="tags">{a.tags.map((t) => <span class="tag tag-outline" key={t}>{t}</span>)}</div>
                <div class="actions">
                  <button class="btn btn-secondary" onClick={() => clip(installSnippet(cat, a.plugin), `c${a.id}`)}>{copied === `c${a.id}` ? s.copied : s.copy}</button>
                  <button class="btn btn-primary" onClick={() => addPlugin(a.plugin)}>{inB ? s.added : s.add}</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div class="empty">
          <div class="big">{s.none}</div>
          <p class="muted">{s.noneHint}</p>
          <div class="row">
            <button class="btn btn-secondary" onClick={clearAll}>{s.clear}</button>
            <button class="btn btn-ghost" onClick={() => setView('wizard')}>{s.helpMe}</button>
            <a href={`https://github.com/${cat.marketplace.repo}/issues/new`} rel="noopener noreferrer" style="font-size:14px">{s.suggest}</a>
          </div>
        </div>
      )}
    </main>
  );

  // ---- compare (individual artifacts, 2–3 at a time) ----
  const ca = cmp.map((id) => cat.artifacts.find((a) => a.id === id)).filter(Boolean) as Artifact[];
  const yn = (b: boolean) => (b ? s.declaredYes : s.no);
  const list = (xs?: string[]) => (xs && xs.length ? xs.join(', ') : '—');
  // [label, value, highlight differences?, monospace?]
  const rows: [string, (a: Artifact) => string, boolean, boolean][] = [
    [s.d.type, (a) => a.type, true, false],
    [s.d.plugin, (a) => a.plugin, true, false],
    [s.rows.version, (a) => `v${plugin(a.plugin).version}`, true, false],
    [s.rows.description, (a) => a.description, false, false],
    [s.d.model, (a) => a.meta?.model ?? '—', true, false],
    [s.d.tools, (a) => list(a.meta?.tools), true, false],
    [s.d.skillsUsed, (a) => list(a.meta?.skills), true, false],
    [s.rows.runs, (a) => yn(plugin(a.plugin).trust.runsCommands), true, false],
    [s.rows.net, (a) => yn(plugin(a.plugin).trust.usesNetwork), true, false],
    [s.d.tags, (a) => a.tags.join(', '), false, false],
    [s.rows.updated, (a) => plugin(a.plugin).updatedAt, true, false],
    [s.rows.install, (a) => `claude plugin install ${a.plugin}@${cat.marketplace.name}`, false, true],
  ];
  const cols = `180px repeat(${Math.max(ca.length, 1)},minmax(200px,1fr))`;
  const compare = (
    <main class="main">
      <h1 class="h-page">{s.compare}</h1>
      {ca.length < 2 ? (
        <div class="guide">{s.cmpGuide} <button class="btn btn-ghost" style="margin-left:12px" onClick={() => setView('browse')}>{s.browse}</button></div>
      ) : (
        <>
          <div class="cmp-wrap">
            <div class="cmp-row" style={{ gridTemplateColumns: cols }}>
              <div class="cmp-label" />
              {ca.map((a) => (
                <div class="cmp-head" key={a.id}>
                  <button class="rcard-title" onClick={() => setDetail(a.id)}>{a.name}</button>
                  <div><button class="linkbtn" onClick={() => toggleCmp(a.id)}>{s.remove}</button></div>
                </div>
              ))}
            </div>
            {rows.map(([label, f, hl, mono]) => {
              const vals = ca.map(f), diff = hl && new Set(vals).size > 1;
              return (
                <div class="cmp-row" style={{ gridTemplateColumns: cols }} key={label}>
                  <div class="cmp-label">{label}</div>
                  {vals.map((v, j) => <div class={`cmp-cell${diff ? ' diff' : ''}${mono ? ' mono' : ''}`} key={j}>{v}</div>)}
                </div>
              );
            })}
          </div>
          <p class="muted" style="font-size:12px;margin-top:14px">{s.diffNote}</p>
        </>
      )}
    </main>
  );

  // ---- wizard ----
  const asking = step < wiz.length;
  const label = (k: string) => (s.wizard as Record<string, string>)[k] ?? k;
  const rank = asking ? [] : wizardRank(cat, wiz, ans);
  const wizard = (
    <main class="main narrow">
      <div class="kicker">{asking ? `${step + 1} / ${wiz.length}` : '✓'}</div>
      <h1 style="font-weight:400;font-size:48px;line-height:1.05;margin:10px 0 28px">{asking ? label(wiz[step].q) : s.yourShortlist}</h1>
      {asking ? (
        <>
          <div class="wiz-opts">
            {wiz[step].options.map((o, i) => (
              <button class="wiz-opt" onClick={() => { setAns({ ...ans, [step]: i }); setStep(step + 1); }}><span>{label(o.label)}</span><span>→</span></button>
            ))}
          </div>
          <div style="display:flex;gap:10px;margin-top:22px">
            <button class="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))}>{s.back}</button>
            <button class="btn btn-ghost" onClick={() => setStep(step + 1)}>{s.skip}</button>
          </div>
        </>
      ) : (
        <div style="display:flex;flex-direction:column;gap:18px">
          {rank.map((r) => (
            <div class="card" style="padding:20px;gap:6px" key={r.x.id}>
              <div style="display:flex;gap:10px;align-items:baseline"><span class="tag tag-accent">{r.x.type}</span><span style="font-family:var(--font-heading);font-size:26px">{r.x.name}</span></div>
              <div style="font-size:14px;line-height:1.5">{r.x.description}</div>
              <div class="why">{s.why}: {r.hit.length ? r.hit.join(', ') : s.matchesType}</div>
              <div><button class="btn btn-primary" onClick={() => addPlugin(r.x.plugin)}>{basket.includes(r.x.plugin) ? s.added : s.add}</button></div>
            </div>
          ))}
          {rank.length < 2 && <p class="muted">{s.thin}</p>}
          <div style="display:flex;gap:10px">
            <button class="btn btn-secondary" onClick={() => {
              const t0 = ans[0] !== undefined ? wiz[0].options[ans[0]].tags?.[0] ?? '' : '';
              setQ(t0); setType(ans[1] !== undefined ? wiz[1].options[ans[1]].type ?? 'all' : 'all'); setView('browse');
            }}>{s.openSearch}</button>
            <button class="btn btn-ghost" onClick={() => { setStep(0); setAns({}); }}>{s.restart}</button>
          </div>
        </div>
      )}
    </main>
  );

  // ---- details panel ----
  const da = detail ? cat.artifacts.find((a) => a.id === detail) : undefined;
  const dp = da ? plugin(da.plugin) : undefined;
  const gh = (ref: string, path = '') => `https://github.com/${cat.marketplace.repo}/${path ? 'blob' : 'tree'}/${ref}${path ? `/${path}` : ''}`;
  const facts: [string, string | undefined][] = da ? [
    [s.d.model, da.meta?.model],
    [s.d.tools, da.meta?.tools?.join(', ')],
    [s.d.disallowed, da.meta?.disallowedTools?.join(', ')],
    [s.d.skillsUsed, da.meta?.skills?.join(', ')],
    [s.d.allowedTools, da.meta?.allowedTools],
    [s.d.event, da.meta?.event],
    [s.d.matcher, da.meta?.matcher],
    [s.d.transport, da.meta?.transport],
    [s.d.scripts, da.meta?.bundledScripts ? s.declaredYes : undefined],
  ].filter(([, v]) => v) as [string, string][] : [];
  const siblings = da ? cat.artifacts.filter((a) => a.plugin === da.plugin && a.id !== da.id) : [];
  const details = da && dp && (
    <>
      <div class="scrim" onClick={() => setDetail(null)} />
      <aside class="drawer detail" role="dialog" aria-modal="true" aria-label={da.name}>
        <div class="drawer-head">
          <span class="tag tag-accent">{da.type}</span>
          <button class="btn btn-ghost" onClick={() => setDetail(null)} aria-label={s.d.close}>Esc</button>
        </div>
        <h2>{da.name}</h2>
        <div class="meta muted">
          {s.in} <button class="linkbtn" onClick={() => setDetail(`${dp.id}/plugin/${dp.id}`)}>{dp.id}</button> · <span class="ver">v{dp.version}</span>
          {dp.tag ? <> · <a href={gh(dp.tag)} target="_blank" rel="noopener noreferrer">{dp.tag}</a></> : <> · {s.d.untagged}</>}
        </div>
        <p class="detail-desc">{da.description}</p>
        {da.tags.length > 0 && <div class="tags">{da.tags.map((t) => <span class="tag tag-outline" key={t}>{t}</span>)}</div>}

        {facts.length > 0 && (
          <section>
            <div class="label-s muted">{s.d.details}</div>
            {facts.map(([k, v]) => <div class="brow" key={k}><span class="muted">{k}</span><span class="brow-v">{v}</span></div>)}
          </section>
        )}

        <section>
          <div class="label-s muted">{s.d.plugin} · {dp.id}</div>
          <div class="brow"><span class="muted">{s.rows.version}</span><span class="brow-v">v{dp.version}</span></div>
          <div class="brow"><span class="muted">{s.d.dependencies}</span><span class="brow-v">{dp.dependencies?.length ? dp.dependencies.join(', ') : s.d.none}</span></div>
          <div class="brow"><span class="muted">{s.d.contents}</span><span class="brow-v">{[['skills', dp.counts.skills], ['agents', dp.counts.agents], ['hooks', dp.counts.hooks], ['MCP', dp.counts.mcp]].filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(' · ')}</span></div>
          <div class="brow"><span class="muted">{s.rows.runs}</span><span class="brow-v">{yn(dp.trust.runsCommands)}</span></div>
          <div class="brow"><span class="muted">{s.rows.net}</span><span class="brow-v">{yn(dp.trust.usesNetwork)}</span></div>
          {dp.trust.hooks?.map((h) => <div class="brow" key={h.summary}><span class="muted">Hook</span><span class="brow-v mono">{h.summary}</span></div>)}
        </section>

        <section>
          <div class="label-s muted">{s.d.releases}</div>
          {dp.releases?.length ? dp.releases.map((r) => (
            <div class="release" key={r.version}>
              <div class="release-head"><span class="ver">v{r.version}</span>{r.date && <span class="muted"> · {r.date}</span>}{r.version === dp.version && <span class="tag tag-accent">{s.d.current}</span>}</div>
              {r.sections.map((sec) => (
                <div key={sec.title}>
                  {sec.title && <div class="release-sec">{sec.title}</div>}
                  <ul>{sec.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</ul>
                </div>
              ))}
            </div>
          )) : <p class="muted">{s.d.noReleases}</p>}
        </section>

        <section>
          <div class="label-s muted">{s.rows.install}</div>
          <pre class="script">{installSnippet(cat, dp.id)}</pre>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1" onClick={() => clip(installSnippet(cat, dp.id), `d${da.id}`)}>{copied === `d${da.id}` ? s.copied : s.copy}</button>
            <button class="btn btn-secondary" style="flex:1" onClick={() => addPlugin(dp.id)}>{basket.includes(dp.id) ? s.added : s.add}</button>
            {da.path && <a class="btn btn-ghost" href={gh(dp.tag ?? 'main', da.path)} target="_blank" rel="noopener noreferrer">{s.d.source} ↗</a>}
          </div>
        </section>

        {siblings.length > 0 && (
          <section>
            <div class="label-s muted">{s.d.alsoIn}</div>
            <div class="tags">{siblings.map((a) => <button class="chip" key={a.id} onClick={() => setDetail(a.id)}>{a.type} · {a.name}</button>)}</div>
          </section>
        )}
      </aside>
    </>
  );

  return chrome(
    <>
      {view === 'browse' ? browse : view === 'compare' ? compare : wizard}
      {cmp.length > 0 && view === 'browse' && (
        <div class="tray">
          <span style="font-size:13px">{fill(s.tray, cmp.length)}</span>
          <button class="btn btn-primary" onClick={() => setView('compare')}>{s.compare} →</button>
          <button class="btn btn-ghost" onClick={() => setCmp([])}>{s.clear}</button>
        </div>
      )}
      {details}
      {drawer && !details && (
        <>
          <div class="scrim" onClick={() => setDrawer(false)} />
          <aside class="drawer" role="dialog" aria-label={s.basket}>
            <div class="drawer-head"><h2>{s.basket}</h2><button class="btn btn-ghost" onClick={() => setDrawer(false)}>Esc</button></div>
            {basket.length === 0 && <p class="muted">{s.emptyBasket}</p>}
            {basket.map((id) => (
              <div class="brow" key={id}><span>{id}</span><button class="linkbtn" onClick={() => setBasket(basket.filter((i) => i !== id))}>{s.remove}</button></div>
            ))}
            {basket.length > 0 && (
              <>
                <div class="label-s muted">install.sh</div>
                <pre class="script">{script}</pre>
                <div class="muted" style="font-size:12px">?basket={basket.join(',')}</div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-primary" style="flex:1" onClick={() => clip(script, 's')}>{copied === 's' ? s.copied : s.copy}</button>
                  <button class="btn btn-secondary" style="flex:1" onClick={downloadScript}>{s.download}</button>
                  <button class="btn btn-ghost" onClick={() => setBasket([])}>{s.clear}</button>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </>,
  );
}
