# Rollback runbook

1. Record the currently deployed version or commit.
2. Stop the application process.
3. Restore the previous application artifact or checkout.
4. Restart the application.
5. Verify `/health/live` and `/health/db`.
6. Verify authentication and a representative data read.
7. If a migration caused the issue, use a forward fix or restore from a tested backup. Do not reverse migrations manually.
   EOF
