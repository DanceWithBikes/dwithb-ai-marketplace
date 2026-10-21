// Shape of public/quality.json, written by scripts/build-quality.mjs.
export interface EvalCase { name: string; runs: number; passed: number; costUsd: number; costPerSuccessUsd: number | null; graders: number; failedGraders: string[] }
export interface EvalResult {
  key: string; file: string; kind: 'suite' | 'smoke'; channel: 'latest' | 'stable'; version: string | null;
  date: string; model: string; judge: string | null; threshold: number | null; durationSeconds: number | null; claudeVersion: string | null;
  runs: number; passed: number; passRate: number; costUsd: number; costPerSuccessUsd: number | null; cases: EvalCase[];
}
export interface Channel { id: 'latest' | 'stable'; branch: string; marketplace: string; add: string; plugins: { id: string; version: string | null; pinned: string | null }[] }
export interface Install { file: string; label: string; marketplace: string | null; version: string | null; plugins: { id: string; version: string; enabled: boolean; errors: number }[] }
interface Side { key: string; version: string; runs: number; passed: number; passRate: number; costUsd: number; costPerSuccessUsd: number | null }
export interface Quality {
  schemaVersion: 1; plugin: string; generatedAt: string | null;
  channels: Channel[]; installs: Install[]; evals: EvalResult[];
  comparison: { cases: string[]; model: string; before: Side; after: Side } | null;
  models: { version: string; tag: string | null; agents: { agent: string; model: string | null; effort: string | null }[] }[];
}
