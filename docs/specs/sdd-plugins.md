# Spec: SDD Engineering та reusable-плагіни

Status: Implemented — sdd-engineering 1.1.0 (tag sdd-engineering--v1.1.0), stable channel 1.0.0 · Scope: 4 плагіни, v1.0.0 · Date: 2026-10-20 · Source: `dev-digest/.claude/`

## 1. Мета

Перенести Spec-Driven-Development конвеєр з локального репозиторію `dev-digest`
у цей marketplace як набір плагінів. Частини, що перевикористовуються (скіли,
`researcher`, `architecture-reviewer`), стають окремими плагінами-залежностями.
Плагін `sdd-engineering` підключає їх і додає власні агенти конвеєра.

**Включаємо:**
- у `sdd-engineering`: агенти `spec-creator`, `implementation-planner`,
  `implementer`, `plan-verifier`, скіл `workflow-retro` (аналізує завершений
  прогін), evals і документацію;
- `researcher` і `architecture-reviewer` підключаємо як dependencies.

**Не переносимо (non-goals):**
- product specs, secrets, cache;
- DevDigest-specific інструкції: модулі `client/`, `server/`, `reviewer-core/`,
  `e2e/`, дві копії `@devdigest/shared`, `~/.devdigest/secrets.json`,
  «15 файлів `docs/insights.md`», `server/clones/**`;
- агенти `test-writer`, `doc-writer`, `insights-curator`;
- скіли `engineering-insights`, `pr-self-review`, `dependency-checker`,
  `mermaid-diagram`;
- `next-best-practices`: джерело (`vercel-labs/next-skills`) не має ліцензії,
  тож перевидавати його не можна. Next.js-скіли ставляться окремо:
  `npx skills add vercel/next.js` (див. §10);
- `run-plan`: відкладено (див. §10).

## 2. Рішення

| Тема | Рішення |
|---|---|
| Кількість плагінів | 4: `engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering` |
| Залежності | Поле `dependencies` у `plugin.json`, діапазон `^1.0.0` |
| Версія | Лише в `plugin.json`, не в marketplace entry; старт `1.0.0` для всіх |
| Релізи | Git-теги `<plugin>--v<version>` на цьому репо + `CHANGELOG.md` у кожному плагіні |
| Виклик скілів | Через namespace: `engineering-paved-path:<skill>` |
| Скрипти скілів | Через `${CLAUDE_SKILL_DIR}`, ніколи не через `.claude/skills/` |
| Шляхи проєкту | `userConfig` плагіна `sdd-engineering` (діалог при ввімкненні, з типовими значеннями) замість захардкоджених DevDigest-шляхів; той, хто викликає агента, може перевизначити шлях явно |
| Evals | Нативний формат `claude plugin eval` |
| `run-plan` | Не входить у v1.0.0 |

## 3. Граф залежностей

```
                 engineering-paved-path   (лише skills)
                    ▲               ▲
                    │ ^1.0.0        │ ^1.0.0
                    │        architecture-review   (agent architecture-reviewer)
                    │               ▲
research-tools      │               │ ^1.0.0
(agent researcher)  │               │
        ▲ ^1.0.0    │               │
        └───────────┴── sdd-engineering ──┘
```

- `sdd-engineering` залежить від усіх трьох у діапазоні `^1.0.0`.
- `architecture-review` залежить від `engineering-paved-path`, бо агент
  завантажує `backend-onion-architecture` і `frontend-ui-architecture`
  (frontmatter `skills:`), а в тексті посилається на `security`, `zod` і
  `drizzle-orm-patterns`. На слайді цього ребра немає, це наше рішення.
- `sdd-engineering`: `implementation-planner` і `implementer` завантажують
  скіли paved-path; planner і plan-verifier передають роботу
  `research-tools:researcher` і `architecture-review:architecture-reviewer`.
- `research-tools` і `engineering-paved-path` нічого не потребують.

Встановлення `sdd-engineering` автоматично ставить і вмикає всі залежності
(`claude plugin install sdd-engineering@dwithb-ai-marketplace`).

## 4. Склад плагінів

| Плагін | Компоненти | Джерело в `dev-digest` |
|---|---|---|
| `engineering-paved-path` | skills: `react-best-practices`, `fastify-best-practices`, `backend-onion-architecture`, `frontend-ui-architecture`, `react-testing-library`, `security`, `typescript-expert`, `zod`, `drizzle-orm-patterns`, `postgresql-table-design` | `.claude/skills/<name>/` |
| `research-tools` | agent `researcher` (read-only: Read, Grep, Glob, Bash, WebSearch, WebFetch) | `.claude/agents/researcher.md` |
| `architecture-review` | agent `architecture-reviewer` (узагальнений, read-only) | `.claude/agents/architecture-reviewer.md` |
| `sdd-engineering` | agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; skill `workflow-retro`; hook write-guard для `spec-creator`; evals; README; CHANGELOG | `.claude/agents/*.md`, `.claude/skills/workflow-retro/`, `.claude/hooks/spec-creator-write-guard.mjs`, `.claude/agents/README.md` |

### 4.1 Layout

```
plugins/
├── engineering-paved-path/
│   ├── .claude-plugin/plugin.json
│   ├── README.md · CHANGELOG.md
│   └── skills/<skill>/SKILL.md (+ references/, scripts/ якщо є)
├── research-tools/
│   ├── .claude-plugin/plugin.json
│   ├── README.md · CHANGELOG.md
│   └── agents/researcher.md
├── architecture-review/
│   ├── .claude-plugin/plugin.json
│   ├── README.md · CHANGELOG.md
│   ├── agents/architecture-reviewer.md
│   └── evals/
└── sdd-engineering/
    ├── .claude-plugin/plugin.json
    ├── README.md · CHANGELOG.md
    ├── agents/
    │   ├── spec-creator.md
    │   ├── implementation-planner.md
    │   ├── implementer.md
    │   └── plan-verifier.md
    ├── skills/workflow-retro/
    │   ├── SKILL.md
    │   ├── references/heuristics.md
    │   └── scripts/{retro,append-ledger,lib}.mjs (+ retro.test.mjs)
    ├── hooks/
    │   ├── hooks.json
    │   └── spec-creator-write-guard.mjs
    └── evals/<case>/{prompt.md, case.yaml?, graders/*.md}
```

### 4.2 `sdd-engineering/.claude-plugin/plugin.json`

```json
{
  "name": "sdd-engineering",
  "version": "1.0.0",
  "description": "Spec-Driven Development pipeline: spec → plan → implement → verify, plus run retros. Use when building a feature from a spec with subagents.",
  "author": { "name": "DanceWithBikes" },
  "keywords": ["sdd", "spec", "planning", "agents", "workflow"],
  "dependencies": [
    { "name": "engineering-paved-path", "version": "^1.0.0" },
    { "name": "research-tools", "version": "^1.0.0" },
    { "name": "architecture-review", "version": "^1.0.0" }
  ],
  "userConfig": {
    "specs_dir": {
      "type": "string",
      "title": "Specs directory",
      "description": "Where spec-creator writes specs, relative to the project root",
      "default": "docs/specs"
    },
    "plans_dir": {
      "type": "string",
      "title": "Plans directory",
      "description": "Where plans and verification reports are saved, one folder per feature",
      "default": "docs/plans"
    },
    "retro_ledger": {
      "type": "string",
      "title": "Retro ledger file",
      "description": "File workflow-retro appends one row per run to",
      "default": "docs/retros/ledger.md"
    }
  }
}
```

`userConfig` — це діалог, який Claude Code показує, коли користувач вмикає плагін.
Кожне поле має типове значення, тож можна просто погодитися. Пізніше значення
змінюються через `/config`. В агентах і скілах на них посилаємося як
`${user_config.specs_dir}`: Claude Code підставляє значення в текст під час
завантаження.

`architecture-review/plugin.json` має `dependencies: [{ "name": "engineering-paved-path", "version": "^1.0.0" }]`.

## 5. Правила узагальнення

1. **DevDigest-шляхи стають налаштуваннями.** Шляхи беруться з `userConfig`
   (§4.2). Той, хто викликає агента, може передати інший шлях явно:

   | Input | Значення |
   |---|---|
   | spec | `${user_config.specs_dir}/<feature>.md` |
   | plan | `${user_config.plans_dir}/<feature>/plan.md` |
   | verification | `${user_config.plans_dir}/<feature>/verification.md` |
   | retro ledger | `${user_config.retro_ledger}` |
   | module map | `AGENTS.md` / `CLAUDE.md` проєкту, без захардкодженого списку модулів |

2. **Скіли викликаємо тільки через namespace:**
   `engineering-paved-path:react-best-practices` у frontmatter `skills:` і в
   таблиці glob→skill у `implementer`.
3. **Скрипти шукаємо через `${CLAUDE_SKILL_DIR}`.** Наприклад,
   `node "${CLAUDE_SKILL_DIR}/scripts/retro.mjs" latest --deep`. Згадки
   `.claude/skills/...` у `SKILL.md`, скриптах і `heuristics.md` прибираємо.
4. **Hook `spec-creator` (переносимо, він робочий).** У dev-digest хук
   оголошений у frontmatter `spec-creator.md` і викликає
   `$CLAUDE_PROJECT_DIR/.claude/hooks/spec-creator-write-guard.mjs`. Для
   агентів із плагіна Claude Code **ігнорує** `hooks`, `mcpServers`,
   `permissionMode` і `initialPrompt` у frontmatter (див. документацію
   «Plugin components → Agents»), тому:
   - у `spec-creator.md` прибираємо блок `hooks:`;
   - хук оголошуємо в `plugins/sdd-engineering/hooks/hooks.json`:
     ```json
     {
       "hooks": {
         "PreToolUse": [
           {
             "matcher": "Write|Edit|MultiEdit|NotebookEdit",
             "hooks": [
               { "type": "command",
                 "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/spec-creator-write-guard.mjs\"" }
             ]
           }
         ]
       }
     }
     ```
   - **у скрипт додаємо фільтр за агентом.** Хук плагіна спрацьовує на кожен
     запис у сесії, а не лише в spec-creator. Тому першим кроком скрипт читає
     `agent_type` з stdin і одразу виходить з кодом `0` (пропускає запис),
     якщо це не spec-creator. Перевірка: `agent_type`
     дорівнює `spec-creator` або закінчується на `:spec-creator`. Точний
     рядок для плагінного агента (очікуємо `sdd-engineering:spec-creator`)
     підтверджуємо тестовим логом під час реалізації. Без цього фільтра хук
     блокуватиме запис файлів усім: основній сесії, implementer тощо;
   - захардкоджене `docs/specs/` у скрипті замінюємо на змінну середовища
     `CLAUDE_PLUGIN_OPTION_SPECS_DIR` (значення `userConfig.specs_dir`,
     Claude Code експортує його в процес хука) з fallback `docs/specs`;
   - у README плагіна описуємо хук: подія, команда, навіщо (вимога
     `docs/PLUGIN-GUIDELINES.md`);
   - додаємо eval-кейс: spec-creator намагається записати файл поза
     specs-папкою, і хук блокує запис. Ще один кейс: implementer пише
     код, і хук його **не** блокує.
5. **Секрети.** Загальне правило «No secrets» (`.env`, key material)
   лишається, згадки конкретних DevDigest-файлів прибираємо.
6. **Посилання між агентами** пишемо з namespace:
   `research-tools:researcher`, `architecture-review:architecture-reviewer`.
7. **Жодних згадок джерела.** У жодному скілі, агенті, скрипті, reference
   чи README не має бути: `DevDigest`/`dev-digest`/`devdigest`,
   `@devdigest/*`, конкретних директорій (`client/`, `server/`,
   `reviewer-core/`, `e2e/`, `server/src/...`), `pnpm arch:check` та інших
   команд конкретного репо, `.claude/skills/`, `.claude/agents/`,
   `.claude/hooks/`. Приклади в скілах подаємо з нейтральними шляхами
   (`src/modules/<m>/...`). Команди проєкту (typecheck, test, arch-check)
   агент бере з `AGENTS.md`/`CLAUDE.md`/`package.json` проєкту. Перевірка:
   `grep -rniE "devdigest|dev-digest|reviewer-core|\.claude/(skills|agents|hooks)" plugins/`
   має повертати порожній результат.
8. **Посилання на те, що не переносимо** (`doc-writer`, `test-writer`,
   `insights-curator`, `engineering-insights`, `pr-self-review`,
   `mermaid-diagram`, `next-best-practices`), прибираємо або замінюємо
   нейтральним формулюванням («documentation step», «your test agent, if
   any»). Вбудовані можливості Claude Code (`/code-review`,
   `/security-review`) згадувати можна.
9. **Frontmatter.** `name`, `description` (≤ ~300 символів, «… Use when …»),
   `tools`, `model`; `metadata.version` синхронізуємо з версією плагіна.

## 6. Як усе працює разом (основа README `sdd-engineering`)

```
питання ──▶ research-tools:researcher ──▶ звіт

фіча ──▶ spec-creator ── pass 1: питання + [NEEDS CLARIFICATION]
              │          pass 2: SPEC-NN draft → docs/specs/<feature>.md
              ▼
        користувач ставить Status: approved (тільки без маркерів)
              ▼
     implementation-planner ──▶ Implementation Plan → docs/plans/<feature>/plan.md
              ▼                 (spec не готовий → назад до spec-creator)
     implementer  (по одному batch, послідовно, свіжий агент на batch;
              │    скіли engineering-paved-path:*)
              ▼
     plan-verifier (Steps mode)
              ▼
     architecture-review:architecture-reviewer  (+ /code-review)
              ▼
     implementer (фікси findings)
              ▼
     plan-verifier (Acceptance mode) ──▶ docs/plans/<feature>/verification.md
              ▼
     /sdd-engineering:workflow-retro ──▶ метрики прогону + docs/retros/ledger.md
```

У README `sdd-engineering` має бути (за `docs/PLUGIN-GUIDELINES.md`):
- призначення і склад;
- ця схема;
- таблиця агентів: input, output, хто пише які файли;
- встановлення;
- приклади промптів;
- залежності;
- hooks, permissions і network (WebSearch/WebFetch лише в `researcher`);
- known limitations, зокрема що `run-plan` ще немає і batch-і запускаємо вручну.

## 7. Версії та релізи

- Semver; `version` задаємо лише в `plugin.json` кожного плагіна.
- Кожен плагін має свій `CHANGELOG.md` у форматі Keep a Changelog
  (`## [1.0.0] - YYYY-MM-DD` / Added / Changed / Removed). Кожна
  user-visible зміна додає ще й рядок у кореневий `CHANGELOG.md`.
- Плагіни підключені через relative path, тож constraints резолвляться по
  git-тегах **цього** репо. Тег створюємо командою `claude plugin tag --push`
  з директорії плагіна, формат `<plugin>--v<version>`: наприклад,
  `engineering-paved-path--v1.0.0`.
- Порядок першого релізу: `engineering-paved-path` → `research-tools` →
  `architecture-review` → `sdd-engineering`.
- Breaking change у dependency (перейменування скіла чи агента) = major bump.
  Після нього `sdd-engineering` розширює діапазон окремим релізом.

## 8. Evals

Пишемо у форматі `claude plugin eval`: кейс складається з
`evals/<case>/prompt.md` і `graders/*.md`, за потреби з `case.yaml`.

| Плагін | Мінімальні кейси |
|---|---|
| `sdd-engineering` | spec-creator ставить `[NEEDS CLARIFICATION]` на неоднозначному запиті; spec-creator не пише поза `docs/specs/`; planner відмовляється від неапрувленого spec; plan-verifier видає verdict у потрібному форматі; workflow-retro коректно рахує fixture-транскрипт |
| `architecture-review` | порт кейсів із `dev-digest/evals/agents/architecture-reviewer/` (без DevDigest-фікстур) |
| `engineering-paved-path` | trigger-кейси для 2–3 скілів (порт із `dev-digest/evals/skills/`) |

`retro.test.mjs` лишається unit-тестом: `node --test`.

## 9. Marketplace і CI

- Додати 4 записи `{ name, source: "./plugins/<name>", description }` у
  `.claude-plugin/marketplace.json`, без `version`.
- Оновити розділ Plugins у кореневому `README.md`.
- У `.github/workflows/validate.yml` увімкнути `--strict`.
- Перевірка: `claude plugin validate --strict .`,
  `claude --plugin-dir ./plugins`, усі 4 разом.

## 9a. Ліцензії та атрибуція

Маркетплейс публічний і поширюється під MIT. Запозичені скіли переносимо лише з
сумісною ліцензією. До кожного такого скіла кладемо `LICENSE` з upstream і
вказуємо джерело в README плагіна.

| Скіл | Upstream | Ліцензія |
|---|---|---|
| `fastify-best-practices` | `mcollina/skills` | MIT |
| `drizzle-orm-patterns` | `giuseppe-trisciuoglio/developer-kit` | MIT |
| `postgresql-table-design` | `wshobson/agents` | MIT |
| `typescript-expert` | `sickn33/antigravity-awesome-skills` | MIT |
| `zod` | `pproenca/dot-skills` | MIT |
| `next-best-practices` | `vercel-labs/next-skills` | **немає**, не включаємо |

Решта скілів і агентів написані в межах курсу (dev-digest), їх публікуємо під
MIT цього репо.

## 10. Roadmap

- Власний Next.js App Router скіл (MIT) замість `next-best-practices`.

- `run-plan`: оркестратор затвердженого плану (implementer по batch →
  plan-verifier). Форму, skill чи workflow, ще не вибрали.
- Решта агентів dev-digest (`test-writer`, `doc-writer`) як окремі плагіни.

## 11. Перевірено наживо (2026-10-20)

- `agent_type` агента з плагіна має значення `sdd-engineering:spec-creator`.
  Хук блокує запис поза specs-папкою.
- `${user_config.*}` **не** підставляється, якщо плагін завантажено через
  `--plugin-dir` і налаштування не заповнені. Тому агенти та `workflow-retro`
  мають явний запасний варіант: якщо видно сирий плейсхолдер, беруть типові
  шляхи (`docs/specs`, `docs/plans`, `docs/retros/ledger.md`). Хук має той
  самий fallback через `CLAUDE_PLUGIN_OPTION_SPECS_DIR`.
- Встановлення з локального marketplace (`plugin install sdd-engineering`)
  автоматично ставить і вмикає 3 залежності. `default` у `userConfig` **не**
  підставляється, поки значення не збережені. Після `/plugin configure
  sdd-engineering@dwithb-ai-marketplace` (або `--config KEY=VALUE` при
  install) підстановка працює.
- У проєкті без specs-папки перша специфікація створює кореневу
  `<specs_dir>/`. Папки модулів мають уже існувати.

## 12. Відкриті питання

- Evals ще не запускалися (`claude plugin eval ... --scaffold`). Для них
  потрібні реальні виклики моделі.
