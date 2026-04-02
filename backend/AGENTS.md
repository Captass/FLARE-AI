# FLARE AI Backend Rules

- Default squad here: `backend_principal` plus the right specialist: `ai_systems_architect`, `integrations_engineer`, or `data_migration_engineer`.
- Add `security_reliability_auditor` for auth, roles, webhooks, billing, secrets, or external services.
- Add `qa_breaker` for user-visible behavior changes, regressions, or bug fixes.
- Protect live behavior first. Avoid broad refactors without a clear payoff.
- Verify auth, organization roles, webhook trust, fallback behavior, and failure handling.
- Run targeted tests or smoke checks after backend changes.
- Update docs if routes, setup, operational behavior, or deployment expectations change.
- Never silently change model routing or worker behavior without documenting the reason.
