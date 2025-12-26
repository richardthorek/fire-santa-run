# Automatic Bug Issue Creation - Implementation Summary

## Overview
This feature automatically creates GitHub issues when the Azure Static Web Apps CI/CD workflow fails on pushes to the main branch.

## Files Modified
1. `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`
   - Added `create_bug_issue_on_failure` job
   - Configures automatic issue creation on workflow failures

## Files Created
1. `docs/WORKFLOW_FAILURE_REPORTING.md`
   - Comprehensive documentation
   - Usage guide and examples
   - Troubleshooting information

## Key Features

### When It Triggers
- ✅ On push to main branch when build_and_deploy_job fails
- ❌ Does NOT trigger on pull requests (to avoid noise)
- ❌ Does NOT trigger on successful workflows

### What's Included in Bug Issues
- Workflow name and run number
- Commit SHA and links
- Failed job details with timestamps
- Failed step information
- Direct links to all logs
- Commit author and message
- Troubleshooting steps
- Automatic `bug` label

### Technical Implementation
- Uses `actions/github-script@v7`
- Fetches data via GitHub REST API
- Formats markdown for readability
- Includes proper permissions (issues:write, actions:read)

## Testing
The feature will automatically activate on the next workflow failure. No manual testing is required.

## Rollback
To disable the feature:
```yaml
# Option 1: Comment out the entire job
# create_bug_issue_on_failure:
#   ...

# Option 2: Disable the condition
create_bug_issue_on_failure:
  if: ${{ false }}  # Disabled
```

## Example Output
When a workflow fails, an issue is created with title:
```
🔥 Workflow Failed: Azure Static Web Apps CI/CD - Run #23
```

The issue body includes:
- 🔥 Failure summary
- 📋 Failed jobs and steps
- 🔗 Log links
- 📝 Commit details
- 🔍 Troubleshooting steps

## Documentation
Full documentation available at: `docs/WORKFLOW_FAILURE_REPORTING.md`
