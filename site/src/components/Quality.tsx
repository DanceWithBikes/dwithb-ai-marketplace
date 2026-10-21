import { useEffect, useState } from 'preact/hooks';
import type { Quality as Q, EvalResult } from '../lib/quality';
import type en from '../i18n/en.json';

type S = typeof en.quality;

const usd = (n: number | null | undefined, d = 3) => (n == null ? '—' : `$${n.toFixed(d)}`);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

// Status never rides on color alone: every state carries an icon and a word.
function Status({ ok, partial, s }: { ok: boolean; partial?: boolean; s: S }) {
  const k = ok ? 'good' : partial ? 'warn' : 'bad';
  return <span class={`q-status q-${k}`}><span aria-hidden="true">{ok ? '✓' : partial ? '◐' : '✗'}</span> {ok ? s.pass : partial ? s.partial : s.fail}</span>;
}

function evalLabel(e: EvalResult, s: S) {
  return `${e.kind === 'smoke' ? s.smoke : s.suite} · ${e.channel === 'stable' ? `${s.stable} ` : ''}${e.version}`;
}

// Horizontal grouped bars: cost per successful run per case, one bar per version.
function CostChart({ q, s }: { q: Q; s: S }) {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const cmp = q.comparison!;
  const series = [cmp.before, cmp.after].map((c) => q.evals.find((e) => e.key === c.key)!);
  const rows = cmp.cases.map((name) => ({ name, vals: series.map((e) => e.cases.find((c) => c.name === name)!) }));
  const max = Math.max(...rows.flatMap((r) => r.vals.map((v) => v.costPerSuccessUsd ?? 0)));
  const W = 1100, LABEL = 320, BAR = 16, GAP = 2, ROW = BAR * 2 + GAP + 20, PAD = 8;
  const H = rows.length * ROW + PAD;
  const x = (v: number) => ((W - LABEL - 70) * v) / max;
  return (
    <div class="q-chart">
      <div class="q-legend" role="list">
        {series.map((e, i) => <span role="listitem" key={e.key}><i class={`q-sw q-s${i + 1}`} /> {e.version}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.chartTitle} onMouseLeave={() => setTip(null)}>
        {rows.map((r, ri) => {
          const y0 = PAD + ri * ROW;
          return (
            <g key={r.name}>
              <text x={LABEL - 10} y={y0 + BAR + 1} text-anchor="end" class="q-axis">{r.name}</text>
              {r.vals.map((v, si) => {
                const y = y0 + si * (BAR + GAP);
                const w = Math.max(x(v.costPerSuccessUsd ?? 0), 2);
                return (
                  <g key={si}>
                    {/* Data end rounded, base square and anchored to the axis. */}
                    <path class={`q-s${si + 1}`} d={`M${LABEL},${y} h${w - 4} q4,0 4,4 v${BAR - 8} q0,4 -4,4 h${-(w - 4)} z`} />
                    <text x={LABEL + w + 6} y={y + BAR - 3} class="q-val">{usd(v.costPerSuccessUsd)}</text>
                  </g>
                );
              })}
              {/* Hit target: the whole row, bigger than the marks. */}
              <rect x={0} y={y0 - 4} width={W} height={ROW - 6} fill="transparent"
                onMouseMove={(ev) => {
                  const box = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({ x: ev.clientX - box.left, y: ev.clientY - box.top, lines: [r.name, ...r.vals.map((v, i) => `${series[i].version}: ${usd(v.costPerSuccessUsd)} / ${s.success} · ${v.passed}/${v.runs} ${s.passedWord} · ${usd(v.costUsd)} ${s.total}`)] });
                }} />
            </g>
          );
        })}
        <line x1={LABEL} x2={LABEL} y1={0} y2={H} class="q-base" />
      </svg>
      {tip && (
        <div class="q-tip" style={{ left: `${tip.x + 14}px`, top: `${tip.y + 10}px` }}>
          {tip.lines.map((l, i) => <div key={i} class={i ? '' : 'q-tip-h'}>{l}</div>)}
        </div>
      )}
      <p class="muted q-note">{fill(s.chartNote, { n: cmp.cases.length, model: cmp.model })}</p>
    </div>
  );
}

export function Quality({ base, s }: { base: string; s: S }) {
  const [q, setQ] = useState<Q | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(`${base}quality.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setQ).catch(() => setError(true));
  }, []);

  if (error) return <main class="main"><div class="empty"><div class="big">{s.noData}</div></div></main>;
  if (!q) return <main class="main" aria-busy="true"><div class="skeleton" /></main>;

  const cmp = q.comparison;
  const stable = q.channels.find((c) => c.id === 'stable');
  const latest = q.channels.find((c) => c.id === 'latest');
  const focusIn = (c?: typeof latest) => c?.plugins.find((p) => p.id === q.plugin);
  const smoke = q.evals.filter((e) => e.kind === 'smoke' && e.channel === 'stable').at(-1);
  const verified = (marketplace: string, version: string | null) =>
    q.installs.find((i) => i.marketplace === marketplace && i.version === version && i.plugins.every((p) => p.enabled && !p.errors));
  const cases = [...new Set(q.evals.flatMap((e) => e.cases.map((c) => c.name)))].sort();
  const agents = [...new Set(q.models.flatMap((m) => m.agents.map((a) => a.agent)))].sort();
  const delta = cmp && cmp.before.costPerSuccessUsd && cmp.after.costPerSuccessUsd ? cmp.after.costPerSuccessUsd / cmp.before.costPerSuccessUsd - 1 : null;

  return (
    <main class="main q">
      <div class="kicker">{q.plugin}</div>
      <h1 class="h-page">{s.title}</h1>
      <p class="muted">{s.lead}</p>

      <section class="q-tiles" aria-label={s.summary}>
        {cmp && (
          <div class="q-tile">
            <div class="q-tile-k">{s.costPerSuccess}</div>
            <div class="q-tile-v">{usd(cmp.after.costPerSuccessUsd)}</div>
            <div class="q-tile-d">{s.was} {usd(cmp.before.costPerSuccessUsd)} · <strong>{delta != null ? `${Math.round(delta * 100)}%` : ''}</strong> ({cmp.before.version} → {cmp.after.version})</div>
          </div>
        )}
        {cmp && (
          <div class="q-tile">
            <div class="q-tile-k">{s.passRate}</div>
            <div class="q-tile-v">{pct(cmp.after.passRate)}</div>
            <div class="q-tile-d">{s.was} {pct(cmp.before.passRate)} · {cmp.after.passed}/{cmp.after.runs} {s.runsWord}</div>
          </div>
        )}
        <div class="q-tile">
          <div class="q-tile-k">{s.latestCh}</div>
          <div class="q-tile-v">{focusIn(latest)?.version ?? '—'}</div>
          <div class="q-tile-d">{latest?.marketplace}</div>
        </div>
        {stable && (
          <div class="q-tile">
            <div class="q-tile-k">{s.stableCh}</div>
            <div class="q-tile-v">{focusIn(stable)?.version ?? '—'}</div>
            <div class="q-tile-d">{smoke ? <>{s.smoke} {smoke.passed}/{smoke.runs} <Status ok={smoke.passed === smoke.runs} s={s} /></> : s.noSmoke}</div>
          </div>
        )}
      </section>

      <section>
        <h2 class="q-h2">{s.channels}</h2>
        <div class="cmp-wrap">
          <table class="q-table">
            <thead><tr><th>{s.plugin}</th>{q.channels.map((c) => <th key={c.id}>{c.id === 'stable' ? s.stableCh : s.latestCh}<div class="muted q-sub">{c.marketplace} · {c.branch}</div></th>)}</tr></thead>
            <tbody>
              {q.channels[0].plugins.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  {q.channels.map((c) => {
                    const cp = c.plugins.find((x) => x.id === p.id);
                    const proof = cp && verified(c.marketplace, p.id === q.plugin ? cp.version : null);
                    const differs = q.channels.some((o) => o.plugins.find((x) => x.id === p.id)?.version !== cp?.version);
                    return (
                      <td key={c.id} class={differs ? 'diff' : ''}>
                        <strong>{cp?.version ?? '—'}</strong>
                        {cp?.pinned && <div class="muted q-sub">📌 {cp.pinned}</div>}
                        {p.id === q.plugin && <div class="q-sub">{proof ? <Status ok s={s} /> : <span class="muted">{s.noInstallProof}</span>} {proof ? s.installed : ''}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {q.channels.map((c) => <pre class="code q-cmd" key={c.id}>{c.add}</pre>)}
      </section>

      {cmp && (
        <section>
          <h2 class="q-h2">{s.chartTitle}</h2>
          <CostChart q={q} s={s} />
        </section>
      )}

      <section>
        <h2 class="q-h2">{s.matrix}</h2>
        <div class="cmp-wrap">
          <table class="q-table">
            <thead>
              <tr>
                <th>{s.case}</th>
                {q.evals.map((e) => (
                  <th key={e.key}>{evalLabel(e, s)}<div class="muted q-sub">{e.date} · {e.model} / {s.judge} {e.judge}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  {q.evals.map((e) => {
                    const c = e.cases.find((x) => x.name === name);
                    if (!c) return <td key={e.key} class="muted">{s.notRun}</td>;
                    const failed = c.failedGraders.length ? `${s.failedGraders}: ${c.failedGraders.join(', ')}` : s.allGraders;
                    return (
                      <td key={e.key} title={failed}>
                        <Status ok={c.passed === c.runs} partial={c.passed > 0 && c.passed < c.runs} s={s} /> {c.passed}/{c.runs}
                        <div class="muted q-sub">{usd(c.costPerSuccessUsd)} / {s.success}{c.failedGraders.length ? ` · ✗ ${c.failedGraders.join(', ')}` : ''}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr class="q-total">
                <td>{s.totalRow}</td>
                {q.evals.map((e) => (
                  <td key={e.key}>
                    <strong>{e.passed}/{e.runs}</strong> ({pct(e.passRate)})
                    <div class="muted q-sub">{usd(e.costUsd, 2)} · {usd(e.costPerSuccessUsd)} / {s.success} · {e.durationSeconds ?? '—'}s</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 class="q-h2">{s.models}</h2>
        <div class="cmp-wrap">
          <table class="q-table">
            <thead><tr><th>{s.agent}</th>{q.models.map((m) => <th key={m.version}>{m.version}<div class="muted q-sub">{m.tag ?? s.untagged}</div></th>)}</tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a}>
                  <td>{a}</td>
                  {q.models.map((m, i) => {
                    const cur = m.agents.find((x) => x.agent === a);
                    const prev = i ? q.models[i - 1].agents.find((x) => x.agent === a) : null;
                    const changed = prev && (prev.model !== cur?.model || prev.effort !== cur?.effort);
                    return <td key={m.version} class={changed ? 'diff' : ''}>{cur ? `${cur.model}${cur.effort ? ` · ${cur.effort}` : ''}` : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p class="muted q-note">{s.sources}</p>
    </main>
  );
}
