// One colour + icon per artifact type, so plugins, skills, agents, hooks and MCP
// servers are told apart at a glance. Colours live in CSS (--t-<type>), per theme.

const PATHS: Record<string, preact.JSX.Element> = {
  // package box
  plugin: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  // lightning bolt
  skill: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />,
  // robot head
  agent: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4.5V8M9 13.5v1M15 13.5v1M9.5 17.5h5" /><circle cx="12" cy="3.5" r="1" /></>,
  // fish hook
  hook: <><path d="M15 3v10.5a5 5 0 0 1-10 0V11" /><path d="m5 11-2.2 2.2M5 11l2.2 2.2" /><circle cx="15" cy="3" r=".6" /></>,
  // plug
  mcp: <><path d="M9 2.5V7M15 2.5V7" /><path d="M6 7h12v4.5a6 6 0 0 1-12 0z" /><path d="M12 17.5V22" /></>,
};

export function TypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  return (
    <svg class="ticon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[type] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export function TypeBadge({ type, label }: { type: string; label: string }) {
  return <span class={`tbadge t-${type}`}><TypeIcon type={type} />{label}</span>;
}
