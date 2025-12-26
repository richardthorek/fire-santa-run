# Automatic Workflow Failure Reporting

## Overview

The Fire Santa Run repository includes an automated system that creates GitHub issues whenever a workflow fails. This helps track and diagnose build/deployment problems quickly.

## How It Works

When the Azure Static Web Apps CI/CD workflow fails on a push to the `main` branch, a new job called `create_bug_issue_on_failure` automatically executes and:

1. **Gathers failure information** from the GitHub Actions API
2. **Creates a detailed bug issue** with comprehensive diagnostic information
3. **Labels the issue** with the `bug` label for easy filtering

## What's Included in the Bug Issue

Each automatically created bug issue contains:

### Workflow Information
- Workflow name
- Run number with link to the workflow run
- Commit SHA with link to the commit
- Branch name
- Who triggered the workflow
- Runner environment details
- Event type (push, pull_request, etc.)

### Failed Jobs Details
For each failed job:
- Job name and status
- Start and completion times
- Direct link to job logs
- List of failed steps within the job

### Logs Access
- Direct links to view full workflow logs
- Job-specific log links for each failed job

### Commit Details
- Commit message
- Author name
- Timestamp

### Troubleshooting Steps
Suggested next steps to diagnose and fix the issue

## Example Issue

```markdown
## 🔥 Workflow Failure Report

**Workflow:** Azure Static Web Apps CI/CD
**Run:** [#23](https://github.com/richardthorek/fire-santa-run/actions/runs/20514144833)
**Commit:** [`ee4c958`](https://github.com/richardthorek/fire-santa-run/commit/ee4c9588edf0068f7bbb61168d3f242b035c026b)
**Branch:** main
**Triggered by:** @richardthorek
**Runner:** ubuntu-latest
**Event:** push

### Failed Jobs

#### Build and Deploy Job
- **Status:** failure
- **Started:** 2025-12-26T02:01:09Z
- **Completed:** 2025-12-26T02:03:46Z
- **Job URL:** https://github.com/richardthorek/fire-santa-run/actions/runs/20514144833/job/58939037703
- **Failed Steps:**
  - Build And Deploy (step 5)

### 📋 Logs

[View full workflow logs](https://github.com/richardthorek/fire-santa-run/actions/runs/20514144833)

**Build and Deploy Job logs:** [View logs](https://github.com/richardthorek/fire-santa-run/actions/runs/20514144833/job/58939037703)

### 📝 Commit Details

**Message:** Updated github copilot instructions and documentation directory
**Author:** Richard Burgoyne-Thorek
**Timestamp:** 2025-12-26T02:01:00Z

### 🔍 Next Steps

1. Review the [workflow logs](https://github.com/richardthorek/fire-santa-run/actions/runs/20514144833) for detailed error messages
2. Check the failed steps listed above
3. Verify the commit changes didn't introduce breaking changes
4. Re-run the workflow after fixing the issue

---
*This issue was automatically created by the workflow failure detection system.*
```

## Workflow Configuration

The feature is implemented in the workflow file:
`.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`

Key configuration:
```yaml
create_bug_issue_on_failure:
  if: ${{ failure() && github.event_name == 'push' }}
  runs-on: ubuntu-latest
  needs: [build_and_deploy_job]
  name: Create Bug Issue on Failure
  permissions:
    issues: write
    actions: read
```

## When Issues Are Created

The automatic bug issue creation:

✅ **WILL trigger** when:
- A workflow fails on a push to the `main` branch
- The `build_and_deploy_job` fails

❌ **WILL NOT trigger** when:
- A workflow succeeds
- A workflow fails on a pull request (to avoid duplicate noise)
- The `close_pull_request_job` fails (it's a cleanup job)

## Disabling the Feature

If the automatic issue creation becomes too noisy or needs to be temporarily disabled:

1. Open `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`
2. Comment out or remove the `create_bug_issue_on_failure` job
3. Commit and push the change

Alternatively, you can modify the `if` condition to never trigger:
```yaml
if: ${{ false }}  # Temporarily disabled
```

## Managing Automated Issues

All issues created by this system are labeled with:
- `bug` - Indicates something isn't working

You can:
- Filter issues by the `bug` label to see all workflow failures
- Close issues once they're resolved
- Add additional labels for categorization
- Assign issues to team members for triage

## Troubleshooting the Feature

If issues are not being created:

1. **Check permissions**: Ensure the workflow has `issues: write` permission
2. **Review the workflow run**: Look for the `Create Bug Issue on Failure` job in failed workflow runs
3. **Check the job logs**: See if there are any errors in the issue creation step
4. **Verify labels exist**: The `bug` label should exist in the repository

## Rollback Plan

As specified in the requirements, you can disable the automatic issue creation by:

1. Removing the `create_bug_issue_on_failure` job from the workflow file
2. Or setting the condition to `if: ${{ false }}`

This will stop new issues from being created while preserving any existing issues for reference.
