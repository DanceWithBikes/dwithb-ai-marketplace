import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Quality as Q, EvalGroup, Stats } from '../lib/quality';
import type en from '../i18n/en.json';

type S = typeof en.quality;

const usd = (n: number | null | undefined, d = 3) => (n == null ? '—' : `$${n.toFixed(d)}`);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const ci = (st: Stats) => (st.passCi ? `${pct(st.passCi[0])}–${pct(st.passCi[1])}` : '—');
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const semver = (a: string, b: string) => a.split('.').map(Number).reduce((d, n, i) => d || n - (Number(b.split('.')[i]) || 0), 0);

// Categorical slots in fixed order; a version keeps its slot on every chart (release order).
const SLOTS = 6;
const AGENT_ORDER = ['main session', 'spec-creator', 'implementation-planner', 'implementer', 'plan-verifier'];
const agentKey = (a: string) => a.replace(/^sdd-engineering:/, '');
const agentSlot = (a: string) => { const i = AGENT_ORDER.indexOf(agentKey(a)); return (i < 0 ? AGENT_ORDER.length : i) + 1; };

// Status never rides on color alone: every state carries an icon and a word.
function Status({ ok, partial, s }: { ok: boolean; partial?: boolean; s: S }) {
  const k = ok ? 'good' : partial ? 'warn' : 'bad';
  return <span class={`q-status q-${k}`}><span aria-hidden="true">{ok ? '✓' : partial ? '◐' : '✗'}</span> {ok ? s.pass : partial ? s.partial : s.fail}</span>;
}

const groupLabel = (e: EvalGroup, s: S) => `${e.kind === 'smoke' ? s.smoke : s.suite} · ${e.channel === 'stable' ? `${s.stable} ` : ''}${e.version}`;

type Tip = { x: number; y: number; lines: string[] } | null;
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = (ev: MouseEvent, lines: string[]) => {
    const box = ((ev.currentTarget as SVGElement).ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTip({ x: ev.clientX - box.left, y: ev.clientY - box.top, lines });
  };
  const el = tip && (
    <div class="q-tip" style={{ left: `${tip.x + 14}px`, top: `${tip.y + 10}px` }}>
      {tip.lines.map((l, i) => <div key={i} class={i ? '' : 'q-tip-h'}>{l}</div>)}
    </div>
  );
  return { show, hide: () => setTip(null), el };
}

function Legend({ items }: { items: { label: string; slot: number }[] }) {
  return (
    <div class="q-legend" role="list">
      {items.map((it) => <span role="listitem" key={it.label}><i class={`q-sw q-c${it.slot}`} /> {it.label}</span>)}
    </div>
  );
}

// Data end rounded (4px), base square and anchored to the axis.
const barPath = (x0: number, y: number, w: number, h: number) =>
  w <= 4 ? `M${x0},${y} h${w} v${h} h${-w} z` : `M${x0},${y} h${w - 4} q4,0 4,4 v${h - 8} q0,4 -4,4 h${-(w - 4)} z`;

// Horizontal grouped bars: cost per successful run per case, one bar per version.
function CostChart({ q, s, slot }: { q: Q; s: S; slot: (v: string | null) => number }) {
  const t = useTip();
  const cmp = q.comparison!;
  const series = [cmp.before, cmp.after].map((c) => q.evals.find((e) => e.key === c.key)!);
  const rows = cmp.cases.map((name) => ({ name, vals: series.map((e) => e.cases.find((c) => c.name === name)!) }));
  const max = Math.max(...rows.flatMap((r) => r.vals.map((v) => v.costPerSuccessUsd ?? 0)));
  const W = 1100, LABEL = 320, BAR = 16, GAP = 2, ROW = BAR * 2 + GAP + 20, PAD = 8;
  const H = rows.length * ROW + PAD;
  const x = (v: number) => ((W - LABEL - 80) * v) / max;
  return (
    <div class="q-chart">
      <Legend items={series.map((e) => ({ label: `${e.version} · ${e.runs / e.cases.length} ${s.runsPerCase}`, slot: slot(e.version) }))} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.chartTitle} onMouseLeave={t.hide}>
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
                    <path class={`q-c${slot(series[si].version)}`} d={barPath(LABEL, y, w, BAR)} />
                    <text x={LABEL + w + 6} y={y + BAR - 3} class="q-val">{usd(v.costPerSuccessUsd)}</text>
                  </g>
                );
              })}
              <rect x={0} y={y0 - 4} width={W} height={ROW - 6} fill="transparent"
                onMouseMove={(ev) => t.show(ev, [r.name, ...r.vals.map((v, i) =>
                  `${series[i].version}: ${usd(v.costPerSuccessUsd)} / ${s.success} · ${v.passed}/${v.runs} ${s.passedWord} · ${s.perRun} ${usd(v.runCost.min)}–${usd(v.runCost.max)} (${s.median} ${usd(v.runCost.median)})`)])} />
            </g>
          );
        })}
        <line x1={LABEL} x2={LABEL} y1={0} y2={H} class="q-base" />
      </svg>
      {t.el}
      <p class="muted q-note">{fill(s.chartNote, { n: cmp.cases.length, model: cmp.model })}</p>
    </div>
  );
}

// Pass rate with its 95% Wilson interval, one row per pooled eval group. One measure, one ink.
function PassChart({ q, s }: { q: Q; s: S }) {
  const t = useTip();
  const W = 1100, LABEL = 320, ROW = 34, PAD = 26, R = W - LABEL - 190;
  const H = q.evals.length * ROW + PAD;
  const x = (v: number) => LABEL + v * R;
  return (
    <div class="q-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.passTitle} onMouseLeave={t.hide}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={PAD - 8} y2={H} class="q-grid" />
            <text x={x(v)} y={12} text-anchor="middle" class="q-axis">{pct(v)}</text>
          </g>
        ))}
        {q.evals.map((e, i) => {
          const y = PAD + i * ROW + ROW / 2;
          return (
            <g key={e.key}>
              <text x={LABEL - 10} y={y + 4} text-anchor="end" class="q-axis">{groupLabel(e, s)}</text>
              {e.passCi && <line x1={x(e.passCi[0])} x2={x(e.passCi[1])} y1={y} y2={y} class="q-ci" />}
              {e.passCi && e.passCi.map((v, k) => <line key={k} x1={x(v)} x2={x(v)} y1={y - 5} y2={y + 5} class="q-ci" />)}
              <circle cx={x(e.passRate)} cy={y} r={5} class="q-dot" />
              <text x={x(1) + 14} y={y + 4} class="q-val">{pct(e.passRate)} · {s.ci95} {ci(e)} · n={e.runs}</text>
              <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill="transparent"
                onMouseMove={(ev) => t.show(ev, [groupLabel(e, s), `${e.passed}/${e.runs} ${s.passedWord} · ${s.ci95} ${ci(e)}`, `${e.sessions.length} ${s.sessionsWord} · ${e.model}`])} />
            </g>
          );
        })}
      </svg>
      {t.el}
      <p class="muted q-note">{s.passNote}</p>
    </div>
  );
}

// One point per eval session in run order; same-version points joined by a 2px line.
function HistoryChart({ q, s, slot }: { q: Q; s: S; slot: (v: string | null) => number }) {
  const t = useTip();
  const pts = q.history;
  const W = 1100, H = 240, L = 70, RP = 90, T = 30, B = 40;
  // Round the top up to a 1-2-5 step so tick labels are clean and clear of the point labels.
  const raw = Math.max(...pts.map((p) => p.costPerSuccessUsd ?? 0)) * 1.25 || 1;
  const step = 10 ** Math.floor(Math.log10(raw / 2));
  const max = [1, 2, 2.5, 5, 10].map((m) => m * step * 2).find((v) => v >= raw) ?? raw;
  const IN = 50; // keep the first and last points clear of the axis labels
  const x = (i: number) => L + IN + (pts.length === 1 ? (W - L - RP - 2 * IN) / 2 : (i * (W - L - RP - 2 * IN)) / (pts.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const versions = [...new Set(pts.map((p) => p.version))];
  const ticks = [0, max / 2, max];
  return (
    <div class="q-chart">
      <Legend items={versions.map((v) => ({ label: v ?? '—', slot: slot(v) }))} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.historyTitle} onMouseLeave={t.hide}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - RP} y1={y(v)} y2={y(v)} class="q-grid" />
            <text x={L - 8} y={y(v) + 4} text-anchor="end" class="q-axis">{usd(v)}</text>
          </g>
        ))}
        {versions.map((v) => {
          const idx = pts.map((p, i) => (p.version === v ? i : -1)).filter((i) => i >= 0);
          return idx.length > 1 && (
            <polyline key={v} class={`q-line q-k${slot(v)}`} points={idx.map((i) => `${x(i)},${y(pts[i].costPerSuccessUsd ?? 0)}`).join(' ')} />
          );
        })}
        {pts.map((p, i) => (
          <g key={p.file}>
            <circle cx={x(i)} cy={y(p.costPerSuccessUsd ?? 0)} r={5} class={`q-c${slot(p.version)} q-ring`} />
            <text x={x(i)} y={y(p.costPerSuccessUsd ?? 0) - 10} text-anchor="middle" class="q-val">{usd(p.costPerSuccessUsd)}</text>
            <text x={x(i)} y={H - 20} text-anchor="middle" class="q-axis">{p.startedAt.slice(5, 16).replace('T', ' ')}</text>
            <text x={x(i)} y={H - 6} text-anchor="middle" class="q-axis">{p.passed}/{p.runs} · {pct(p.passRate)}</text>
            <rect x={x(i) - 40} y={0} width={80} height={H} fill="transparent"
              onMouseMove={(ev) => t.show(ev, [`${p.version} · ${p.startedAt.replace('T', ' ').slice(0, 16)} UTC`, `${usd(p.costPerSuccessUsd)} / ${s.success} · ${p.passed}/${p.runs} ${s.passedWord}`, p.file])} />
          </g>
        ))}
      </svg>
      {t.el}
      <p class="muted q-note">{s.historyNote}</p>
    </div>
  );
}

// Cost of each full pipeline run, stacked by agent (2px surface gap between segments).
function PipelineChart({ q, s }: { q: Q; s: S }) {
  const t = useTip();
  const runs = q.pipelineAgents;
  const agents = [...new Set(runs.flatMap((r) => r.agents.map((a) => agentKey(a.agent))))].sort((a, b) => agentSlot(a) - agentSlot(b));
  const slotOf = (a: string) => Math.min(agentSlot(a), SLOTS);
  const total = (r: (typeof runs)[number]) => (r.mainCostUsd ?? 0) + r.agents.reduce((n, a) => n + a.costUsd, 0);
  const max = Math.max(...runs.map(total)) || 1;
  const W = 1100, LABEL = 220, BAR = 22, ROW = 40, PAD = 6;
  const H = runs.length * ROW + PAD;
  const x = (v: number) => ((W - LABEL - 110) * v) / max;
  return (
    <div class="q-chart">
      <Legend items={['main session', ...agents].map((a) => ({ label: a, slot: slotOf(a) }))} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.pipelineTitle} onMouseLeave={t.hide}>
        {runs.map((r, i) => {
          const y = PAD + i * ROW;
          const segs = [{ agent: 'main session', costUsd: r.mainCostUsd ?? 0, model: null as string | null, tokens: 0 }, ...r.agents.map((a) => ({ ...a, agent: agentKey(a.agent) }))]
            .filter((g) => g.costUsd > 0)
            .sort((a, b) => agentSlot(a.agent) - agentSlot(b.agent));
          let at = LABEL;
          const sum = total(r);
          return (
            <g key={r.file}>
              <text x={LABEL - 10} y={y + BAR - 6} text-anchor="end" class="q-axis">{r.version} · {r.session}</text>
              {segs.map((g, k) => {
                const w = x(g.costUsd);
                const last = k === segs.length - 1;
                const d = last ? barPath(at, y, w, BAR) : `M${at},${y} h${Math.max(w - 2, 0.5)} v${BAR} h${-Math.max(w - 2, 0.5)} z`;
                at += w;
                return (
                  <path key={g.agent} class={`q-c${slotOf(g.agent)}`} d={d}
                    onMouseMove={(ev) => t.show(ev as unknown as MouseEvent, [`${r.version} · ${g.agent}`, `${usd(g.costUsd)} · ${pct(g.costUsd / sum)} ${s.ofRun}${g.model ? ` · ${g.model}` : ''}`])} />
                );
              })}
              <text x={at + 8} y={y + BAR - 6} class="q-val">{usd(sum, 2)} · {r.verdict ?? s.noVerdict}</text>
            </g>
          );
        })}
        <line x1={LABEL} x2={LABEL} y1={0} y2={H} class="q-base" />
      </svg>
      {t.el}
    </div>
  );
}

function Table({ head, children }: { head: ComponentChildren; children: ComponentChildren }) {
  return <div class="cmp-wrap"><table class="q-table"><thead>{head}</thead><tbody>{children}</tbody></table></div>;
}

export function Quality({ base, s }: { base: string; s: S }) {
  const [q, setQ] = useState<Q | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(`${base}quality.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setQ).catch(() => setError(true));
  }, []);

  if (error) return <main class="main"><div class="empty"><div class="big">{s.noData}</div></div></main>;
  if (!q) return <main class="main" aria-busy="true"><div class="skeleton" /></main>;

  const releaseOrder = [...new Set([...q.models.map((m) => m.version), ...q.evals.map((e) => e.version ?? '')])].filter(Boolean).sort(semver);
  const slot = (v: string | null) => Math.min(releaseOrder.indexOf(v ?? '') + 1 || SLOTS, SLOTS);
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
  const pipeBy = (v: string) => q.pipelines.filter((p) => p.version === v);
  const pipeVersions = [...new Set(q.pipelines.map((p) => p.version))].sort(semver);

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
            <div class="q-tile-d">{s.ci95} {ci(cmp.after)} · {s.was} {pct(cmp.before.passRate)} ({ci(cmp.before)})</div>
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
        <Table head={<tr><th>{s.plugin}</th>{q.channels.map((c) => <th key={c.id}>{c.id === 'stable' ? s.stableCh : s.latestCh}<div class="muted q-sub">{c.marketplace} · {c.branch}</div></th>)}</tr>}>
          {q.channels[0].plugins.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              {q.channels.map((c) => {
                const cp = c.plugins.find((x) => x.id === p.id);
                const proof = cp && p.id === q.plugin && verified(c.marketplace, cp.version);
                const differs = q.channels.some((o) => o.plugins.find((x) => x.id === p.id)?.version !== cp?.version);
                return (
                  <td key={c.id} class={differs ? 'diff' : ''}>
                    <strong>{cp?.version ?? '—'}</strong>
                    {cp?.pinned && <div class="muted q-sub">📌 {cp.pinned}</div>}
                    {p.id === q.plugin && <div class="q-sub">{proof ? <><Status ok s={s} /> {s.installed}</> : <span class="muted">{s.noInstallProof}</span>}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </Table>
        {q.channels.map((c) => <pre class="code q-cmd" key={c.id}>{c.add}</pre>)}
      </section>

      {cmp && (
        <section>
          <h2 class="q-h2">{s.chartTitle}</h2>
          <CostChart q={q} s={s} slot={slot} />
        </section>
      )}

      <section>
        <h2 class="q-h2">{s.passTitle}</h2>
        <PassChart q={q} s={s} />
      </section>

      {q.history.length > 0 && (
        <section>
          <h2 class="q-h2">{s.historyTitle}</h2>
          <HistoryChart q={q} s={s} slot={slot} />
        </section>
      )}

      <section>
        <h2 class="q-h2">{s.pipelineTitle}</h2>
        <p class="muted">{s.pipelineLead}</p>
        {q.pipelineAgents.length > 0 ? <PipelineChart q={q} s={s} /> : <p class="muted">{s.noPipeline}</p>}
        {q.pipelines.length > 0 && (
          <Table head={<tr><th>{s.version}</th><th>{s.runsWord}</th><th>{s.okRuns}</th><th>{s.pipeCost}</th><th>{s.costPerSuccessfulPipe}</th></tr>}>
            {pipeVersions.map((v) => {
              const rs = pipeBy(v);
              const ok = rs.filter((r) => r.ok).length;
              const cost = rs.reduce((n, r) => n + (r.costUsd ?? 0), 0);
              return (
                <tr key={v}>
                  <td>{v}</td>
                  <td>{rs.length}</td>
                  <td>{ok}/{rs.length} {rs.map((r) => <Status key={r.session} ok={!!r.ok} s={s} />)}</td>
                  <td>{rs.map((r) => `${usd(r.costUsd, 2)} (${r.tokens}, ${r.wall})`).join(' · ')}</td>
                  <td><strong>{ok ? usd(cost / ok, 2) : '—'}</strong></td>
                </tr>
              );
            })}
          </Table>
        )}
        {q.pipelineAgents.length > 0 && (
          <Table head={<tr><th>{s.agent}</th>{q.pipelineAgents.map((r) => <th key={r.file}>{r.version}<div class="muted q-sub">{r.session}</div></th>)}</tr>}>
            {['main session', ...new Set(q.pipelineAgents.flatMap((r) => r.agents.map((a) => agentKey(a.agent))))].map((a) => (
              <tr key={a}>
                <td>{a}</td>
                {q.pipelineAgents.map((r) => {
                  const g = a === 'main session' ? { costUsd: r.mainCostUsd ?? 0, model: null } : r.agents.find((x) => agentKey(x.agent) === a);
                  return <td key={r.file}>{g ? <>{usd(g.costUsd)}{g.model ? <div class="muted q-sub">{g.model}</div> : null}</> : '—'}</td>;
                })}
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 class="q-h2">{s.matrix}</h2>
        <Table head={
          <tr>
            <th>{s.case}</th>
            {q.evals.map((e) => (
              <th key={e.key}>{groupLabel(e, s)}<div class="muted q-sub">{e.sessions.length} {s.sessionsWord} · {e.model} / {s.judge} {e.judge}</div></th>
            ))}
          </tr>
        }>
          {cases.map((name) => (
            <tr key={name}>
              <td>{name}</td>
              {q.evals.map((e) => {
                const c = e.cases.find((x) => x.name === name);
                if (!c) return <td key={e.key} class="muted">{s.notRun}</td>;
                return (
                  <td key={e.key} title={c.failedGraders.length ? `${s.failedGraders}: ${c.failedGraders.join(', ')}` : s.allGraders}>
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
                <strong>{e.passed}/{e.runs}</strong> ({pct(e.passRate)}, {s.ci95} {ci(e)})
                <div class="muted q-sub">{usd(e.costUsd, 2)} · {usd(e.costPerSuccessUsd)} / {s.success} · {e.durationSeconds}s</div>
              </td>
            ))}
          </tr>
        </Table>
      </section>

      <section>
        <h2 class="q-h2">{s.models}</h2>
        <Table head={<tr><th>{s.agent}</th>{q.models.map((m) => <th key={m.version}>{m.version}<div class="muted q-sub">{m.tag ?? s.untagged}</div></th>)}</tr>}>
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
        </Table>
      </section>

      <p class="muted q-note">{s.sources}</p>
    </main>
  );
}
