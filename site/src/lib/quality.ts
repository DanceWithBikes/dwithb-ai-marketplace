// Shape of public/quality.json, written by scripts/build-quality.mjs.
export interface Stats {
  runs: number; passed: number; passRate: number; passCi: [number, number] | null;
  costUsd: number; costPerSuccessUsd: number | null;
  runCost: { min: number | null; median: number | null; max: number | null };
}
export interface EvalCase extends Stats { name: string; failedGraders: string[] }
// Runs of one kind, channel, version and main model, pooled across eval sessions.
export interface EvalGroup extends Stats {
  key: string; kind: 'suite' | 'smoke'; channel: 'latest' | 'stable'; version: string | null;
  model: string; judge: string | null; sessions: string[]; date: string; durationSeconds: number; cases: EvalCase[];
}
export interface HistoryPoint extends Stats { file: string; startedAt: string; version: string | null; channel: string; model: string }
export interface Channel { id: 'latest' | 'stable'; branch: string; marketplace: string; add: string; plugins: { id: string; version: string | null; pinned: string | null }[] }
export interface Install { file: string; label: string; marketplace: string | null; version: string | null; plugins: { id: string; version: string; enabled: boolean; errors: number }[] }
export interface Pipeline { date: string; session: string; version: string; agents: string; tokens: string; wall: string; costUsd: number | null; ok: boolean | null }
export interface PipelineAgents {
  file: string; session: string; version: string | null; verdict: string | null; costUsd: number | null; mainCostUsd: number | null;
  agents: { agent: string; model: string | null; costUsd: number; tokens: number; runs: number }[];
}
interface Side extends Stats { key: string; version: string }
export interface Quality {
  schemaVersion: 1; plugin: string; generatedAt: string | null;
  channels: Channel[]; installs: Install[]; evals: EvalGroup[];
  comparison: { cases: string[]; model: string; before: Side; after: Side } | null;
  history: HistoryPoint[]; pipelines: Pipeline[]; pipelineAgents: PipelineAgents[];
  models: { version: string; tag: string | null; agents: { agent: string; model: string | null; effort: string | null }[] }[];
}
