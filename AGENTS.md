# équipe Dev pour FLARE AI

## Always-on posture

- Treat this repository as a quality-first, expert-team project.
- Start every FLARE AI task as if `antigravity_lead` is active, even when the user asks casually.
- Do not spawn every specialist by default. Pick the smallest squad that can still deliver an excellent result.
- For any multi-file, cross-domain, risky, or user-visible task, use subagents explicitly.
- Never claim success without verification evidence.

## Repository context

- Product: FLARE AI.
- Frontend stack: Next.js 14, React, Tailwind, Firebase hosting.
- Backend stack: FastAPI, LangGraph, SQLAlchemy, integrations and webhooks.
- Primary business module today: Chatbot Facebook.
- Other important surfaces: Assistant IA, organizations, identity, content studio, billing, automations.

## First reads

- Read `docs/README.md` before major work.
- Read `docs/handover/AI_DEV_HANDOVER.md` before major work.
- Read `docs/handover/FLARE_APP_STATUS_2026-03-28.md` before major work.
- Read `docs/instructions/DEVELOPER_GUIDE.md` (section **Déploiement** → **Windows** / technique `git --git-dir`) before running `git` from an integrated shell when the workspace path contains an apostrophe (`RAM'S FLARE`).
- Then read only the module-specific docs you need.

## Git on Windows (automated shell)

If terminal commands fail with a PowerShell parser error **before** `git` runs, do not rely on `cd` into the repo. Use the **`git --git-dir` / `--work-tree`** pattern (neutral working directory) documented in `docs/instructions/DEVELOPER_GUIDE.md`, or run `scripts/render-deploy.ps1`.

## Mandatory workflow

1. Clarify the real goal, constraints, and acceptance criteria from repo context before changing code.
2. Pick the smallest expert squad that can deliver an excellent result.
3. Split ownership cleanly by layer or risk area.
4. Implement.
5. Run the right checks.
6. Return outcome, verification, remaining risks, and the next best improvement.

## Default squads

- Large or ambiguous feature: `spec_master`, then `antigravity_lead`, then the implementation squad.
- UX, landing, onboarding, or premium UI work: `creative_director`, `frontend_principal`, `qa_breaker`, `performance_release_engineer`.
- Frontend product flows: `frontend_principal`, `qa_breaker`, `performance_release_engineer`.
- Backend API, auth, organizations, or billing: `backend_principal`, `data_migration_engineer`, `security_reliability_auditor`, `qa_breaker`.
- AI orchestration, prompts, tool routing, workers, or memory: `ai_systems_architect`, `backend_principal`, `qa_breaker`.
- External integrations, OAuth, Messenger, Google, Stripe, Firebase, or webhooks: `integrations_engineer`, `security_reliability_auditor`, `qa_breaker`.
- High-risk release or production incident: `antigravity_lead`, `qa_breaker`, `security_reliability_auditor`, `performance_release_engineer`, `documentation_keeper`.

## Quality bar

- Read before editing.
- Prefer a stronger solution when it is realistic, not flashy.
- Challenge weak assumptions.
- Keep frontend intentional and premium, not generic.
- Protect production behavior first.
- Update docs when behavior, setup, or workflow changes.
- Never touch active credentials or `.env` files unless the user explicitly asks.
- Do not revert user changes you did not make.

## Subagent policy

- Use custom project agents from `.codex/agents/`.
- Reviewer agents stay read-only unless the parent explicitly narrows a safe write scope.
- Keep `max_depth = 1`. Fan out once, then integrate centrally.
- Close finished agents promptly.

## Playbook

- For detailed role definitions, handoff rules, and release gates, use `docs/instructions/CODEX_EXPERT_TEAM_PLAYBOOK.md`.
