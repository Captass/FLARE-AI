# FLARE AI Dev Team Playbook

This project uses a quality-first Dev Team operating model.

The goal is not "many agents at once".
The goal is one strong lead, narrow ownership, and aggressive verification before delivery.

## Operating model

- The user talks to one lead: `antigravity_lead`.
- The lead decides whether to stay solo or spawn specialists.
- Implementers own code.
- Reviewers break the plan, the code, or the release before it reaches the user.
- Docs stay current after behavior changes.

## Agent roster

### `antigravity_lead`

- Main coordinator.
- Turns user intent into an execution plan.
- Picks the squad, integrates results, and owns the final response.

### `spec_master`

- Locks scope, acceptance criteria, edge cases, and non-goals.
- Use for vague, large, or risky requests before implementation.

### `creative_director`

- Owns UX direction, visual hierarchy, interaction quality, premium polish, and creative uplift.
- Advises. Frontend code stays with `frontend_principal`.

### `frontend_principal`

- Owns `frontend/` implementation.
- Responsible for real UI behavior, responsive states, accessibility, and production-safe frontend code.

### `backend_principal`

- Owns API and server-side logic in `backend/`.
- Responsible for contracts, permissions, and robust server behavior.

### `ai_systems_architect`

- Owns LangGraph orchestration, prompts, model selection, worker routing, memory, and tool design.

### `integrations_engineer`

- Owns Messenger, Google, Firebase, Stripe, OAuth, webhooks, and external service glue.

### `data_migration_engineer`

- Owns schemas, migrations, persistence safety, and data-shape changes.

### `qa_breaker`

- Owns regression hunting, reproduction, edge cases, and end-to-end skepticism.

### `security_reliability_auditor`

- Owns auth, roles, secrets exposure, webhook trust, abuse paths, and operational safety review.

### `performance_release_engineer`

- Owns latency, build health, bundle impact, deploy readiness, and release risk.

### `documentation_keeper`

- Owns handover notes, changed behavior docs, and release notes.

## Squad recipes

### UI-heavy feature

- `spec_master` if request is vague or large
- `creative_director`
- `frontend_principal`
- `qa_breaker`
- `performance_release_engineer` if motion, streaming, or bundle weight matters

### Backend or auth feature

- `spec_master` if risky or cross-cutting
- `backend_principal`
- `data_migration_engineer` if persistence changes
- `security_reliability_auditor`
- `qa_breaker`

### AI architecture change

- `spec_master` if routing behavior is unclear
- `ai_systems_architect`
- `backend_principal`
- `qa_breaker`
- `security_reliability_auditor` if prompts or tools touch sensitive data

### Integration or webhook work

- `integrations_engineer`
- `backend_principal`
- `security_reliability_auditor`
- `qa_breaker`

### Release or stabilization pass

- `antigravity_lead`
- `qa_breaker`
- `security_reliability_auditor`
- `performance_release_engineer`
- `documentation_keeper`

## Ownership rules

- `creative_director` does not own production frontend code.
- `spec_master` does not write product code.
- `qa_breaker` does not silently "fix" the product; it proves what is broken.
- `security_reliability_auditor` can block a release.
- `documentation_keeper` updates docs after behavior changes, not before.

## Exit gates

Before a task is considered done:

1. The implementation owner verifies the intended behavior.
2. `qa_breaker` looks for regressions or untested paths on non-trivial changes.
3. `security_reliability_auditor` reviews auth, roles, integrations, or sensitive flows when applicable.
4. `performance_release_engineer` checks build or release risk when frontend or deployment behavior changed.
5. `documentation_keeper` updates docs when product or setup behavior changed.

## FLARE-specific reminders

- Chatbot Facebook is the primary business surface today.
- Assistant IA is still important but secondary in product hierarchy.
- Organizations, branding, and role boundaries are not cosmetic. Treat them as product-critical.
- Locked modules must remain honest. Do not create fake-ready flows.
- Stability beats flash when those two goals conflict.
- **Windows / Git:** if the workspace path contains an apostrophe (`FLARE AI`), integrated shells may fail before `git` runs. For automated `git`, use **`git --git-dir` / `--work-tree`** from a neutral cwd (see `docs/instructions/DEVELOPER_GUIDE.md`, Deployment → Windows). `performance_release_engineer` and implementers should follow this when pushing or verifying commits.
