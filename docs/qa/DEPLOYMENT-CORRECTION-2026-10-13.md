# Deployment verification checklist

Environment-specific diagnostics and rollback references are retained privately. This public checklist contains no production identifiers, database inventory or operational log findings.

1. Compare intended source revision with frontend and backend releases; verify tenant domains belong to the intended project and advance with approved releases.
2. Verify readiness and authorized read-only access. Run write tests only with synthetic disposable accounts.
3. Require successful CI before automatic releases. The local blueprint proposes Render checksPass and /health/ready. Review existing service mapping before applying it.
4. Generate schema SQL from the exact release, verify backup/restore, rehearse compatibility and rollback, and obtain environment-specific approval. Do not enable automatic production migrations.

GitHub publication does not confirm deployment or migration success. Production changes retain separate approval gates.

References: [Render deployment gates](https://render.com/docs/deploys), [Render Blueprint schema](https://render.com/docs/blueprint-spec).
