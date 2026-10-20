export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'hook' | 'mcp';

export interface Release {
  version: string; date: string | null;
  sections: { title: string; items: string[] }[];
}
export interface Plugin {
  id: string; version: string; updatedAt: string;
  counts: { skills: number; agents: number; hooks: number; mcp: number };
  trust: { runsCommands: boolean; usesNetwork: boolean; hooks?: { event: string; summary: string }[] };
  keywords: string[];
  description?: string; dependencies?: string[]; path?: string;
  tag?: string | null; releases?: Release[];
}
export interface ArtifactMeta {
  model?: string; tools?: string[]; disallowedTools?: string[]; skills?: string[];
  allowedTools?: string; bundledScripts?: boolean; event?: string; matcher?: string; transport?: string;
}
export interface Artifact {
  id: string; type: ArtifactType; plugin: string; name: string; description: string; tags: string[];
  path?: string; meta?: ArtifactMeta;
}
export interface Catalog {
  marketplace: { name: string; repo: string; description: string };
  plugins: Plugin[]; artifacts: Artifact[];
}
export interface WizardOption { label: string; tags?: string[]; type?: ArtifactType; allowHooksMcp?: boolean }
export interface WizardStep { q: string; options: WizardOption[] }

const STOP = new Set('i need a an the for to of and with my me skill agent that'.split(' '));

export function terms(q: string): string[] {
  return q.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
}

function score(a: Artifact, ts: string[]): number {
  if (!ts.length) return 1;
  let sc = 0;
  for (const t of ts) {
    if (a.name.includes(t)) sc += 5;
    if (a.description.toLowerCase().includes(t)) sc += 3;
    if (a.tags.some((x) => x.includes(t))) sc += 3;
    if (a.plugin.includes(t)) sc += 2;
  }
  return sc;
}

export interface Filters { q: string; type: string; hooksOnly: boolean; sort: 'rel' | 'az' | 'new' }

export function search(cat: Catalog, f: Filters): Artifact[] {
  const plugin = (id: string) => cat.plugins.find((p) => p.id === id);
  const ts = terms(f.q);
  let r = cat.artifacts.map((a) => ({ a, sc: score(a, ts) })).filter((x) => x.sc > 0);
  if (f.type !== 'all') r = r.filter((x) => x.a.type === f.type);
  if (f.hooksOnly) r = r.filter((x) => (plugin(x.a.plugin)?.counts.hooks ?? 0) > 0);
  if (f.sort === 'az') r.sort((x, y) => x.a.name.localeCompare(y.a.name));
  else if (f.sort === 'new') r.sort((x, y) => (plugin(y.a.plugin)?.updatedAt ?? '').localeCompare(plugin(x.a.plugin)?.updatedAt ?? ''));
  else r.sort((x, y) => y.sc - x.sc);
  return r.map((x) => x.a);
}

export function installScript(cat: Catalog, ids: string[]): string {
  if (!ids.length) return '';
  const mk = cat.marketplace;
  return [`claude plugin marketplace add ${mk.repo}`, ...ids.map((id) => `claude plugin install ${id}@${mk.name}`)].join('\n');
}

export function installSnippet(cat: Catalog, id: string): string {
  return installScript(cat, [id]);
}

export interface WizardAnswers { [step: number]: number }

export function wizardRank(cat: Catalog, steps: WizardStep[], ans: WizardAnswers) {
  const pick = (i: number) => (ans[i] !== undefined ? steps[i]?.options[ans[i]] : undefined);
  const tags = pick(0)?.tags ?? [];
  const type = pick(1)?.type;
  const ok = pick(2)?.allowHooksMcp ?? true;
  return cat.artifacts
    .map((x) => {
      const hit = tags.filter((t) => x.tags.includes(t));
      let sc = hit.length * 3 + (type && x.type === type ? 2 : 0);
      const p = cat.plugins.find((p) => p.id === x.plugin);
      if (!ok && p && (p.counts.hooks > 0 || p.counts.mcp > 0)) sc = 0;
      return { x, sc, hit };
    })
    .filter((r) => r.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3);
}
