# ROADMAP.md Usage Guide

## Overview

The ROADMAP.md has been reorganized to serve as a **single source of truth** for all planned work. This guide explains how to use it effectively.

## Structure

### 1. Release 1 Summary (Complete)
Historical record of implemented features. **Read-only** - documents completed work.

### 2. Known Gaps & Limitations
Feature gap analysis. Informs future releases. **Reference** when prioritizing work.

### 3. Forward Roadmap
6-month timeline and milestone overview. **Start here** to understand the big picture.

### 4. Release Sections (1 Quality, 2.1, 2.2, 3.1, 3.2, 4)
Each release follows this format:
- **Goal** - What this release achieves
- **Duration & Effort** - Time estimates
- **Dependencies** - What must complete first
- **Issues Table** - Quick reference for all issues
- **Issue Details** - Full specifications with tasks and success criteria

### 5. Issue Automation Strategy
Instructions for automating GitHub Issue creation from ROADMAP.md.

### 6. Success Metrics & Risk Assessment
How to measure success and manage risks.

## How to Use the Roadmap

### For Project Planning

**Creating GitHub Issues:**
1. Navigate to the relevant release section (e.g., "Release 1 Quality Uplift")
2. Copy the "Issues Table" for quick reference
3. For each issue, copy the detailed section including:
   - Title
   - Priority and dependencies
   - Key tasks
   - Success criteria
4. Create GitHub Issue with this content
5. Apply labels: `release-X`, `priority-X`, `estimate-Xh`
6. Assign to appropriate milestone

**Example: Creating Issue #95**
```
Title: Increase Unit Test Coverage to 40%+

Priority: CRITICAL
Dependencies: None
Estimate: 20 hours

## Key Tasks
- [ ] Add unit tests for utility functions (`src/utils/`)
- [ ] Add tests for custom hooks (`src/hooks/`)
...

## Success Criteria
- [ ] Test coverage ≥ 40%
- [ ] All critical paths tested
...
```

### For Sprint Planning

**Selecting Next Sprint's Work:**
1. Check current release's dependencies
2. Identify issues with no blocking dependencies
3. Consider team capacity (hours available)
4. Balance priorities (CRITICAL > HIGH > MEDIUM > LOW)
5. Assign issues to sprint

**Example Sprint:**
```
Sprint 1 (2 weeks, 80 hours capacity):
- #95: Test Coverage (20h, CRITICAL)
- #96: Lighthouse Audit (12h, CRITICAL)
- #97: Accessibility Audit (15h, CRITICAL)
- #98: ESLint Cleanup (10h, HIGH)
- #99: Integration Tests (15h, HIGH)
- #100: Production Validation (8h, HIGH)
Total: 80 hours
```

### For Progress Tracking

**Updating Status:**
1. Mark issue tasks complete in GitHub Issue
2. When issue done, close it
3. Update ROADMAP.md if significant changes made to scope
4. Document any dependencies discovered

**Checking Dependencies:**
Each issue lists dependencies clearly:
```
Dependencies: #95 (must complete first)
```

Before starting an issue, verify all dependencies are resolved.

### For Stakeholder Communication

**Reporting Progress:**
1. Reference release sections for current phase
2. Show completed vs. remaining issues
3. Highlight blocked items (dependencies not met)
4. Estimate completion based on velocity

**Example Status Report:**
```
Release 1 Quality Uplift Progress:
- Issues Complete: 4/6 (67%)
- Hours Complete: 52/80 (65%)
- On track for early January completion
- Blockers: None
```

## Automation Setup

### Automatic Issue Creation

**Recommended: GitHub Actions Workflow**

Create `.github/workflows/sync-roadmap-issues.yml`:

```yaml
name: Sync Roadmap to GitHub Issues

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Preview changes without creating issues'
        required: false
        default: 'true'

jobs:
  sync-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Sync Issues
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const roadmap = fs.readFileSync('ROADMAP.md', 'utf8');
            
            // Parse ROADMAP.md and create issues
            // See full implementation in ROADMAP.md "Issue Automation Strategy"
```

**Running the Workflow:**
1. Go to Actions tab in GitHub
2. Select "Sync Roadmap to GitHub Issues"
3. Click "Run workflow"
4. Choose dry_run: true to preview (recommended first time)
5. Review output, then run with dry_run: false to create issues

### Manual Issue Creation (Quick Start)

**For immediate use before automation:**

1. **Create Milestones** (Settings > Milestones):
   - Release 1 Quality Uplift (Due: Jan 15, 2025)
   - Release 2.1 - UX Polish (Due: Jan 31, 2025)
   - Release 2.2 - Analytics (Due: Feb 28, 2025)
   - Release 3.1 - PWA Core (Due: Mar 31, 2025)
   - Release 3.2 - Advanced Mobile (Due: Apr 30, 2025)
   - Release 4 - Platform (Due: May 31, 2025)

2. **Create Labels** (Settings > Labels):
   - `release-1-quality`, `release-2.1`, `release-2.2`, `release-3.1`, `release-3.2`, `release-4`
   - `priority-critical`, `priority-high`, `priority-medium`, `priority-low`
   - `estimate-5h`, `estimate-8h`, `estimate-10h`, `estimate-12h`, `estimate-15h`, `estimate-18h`, `estimate-20h`

3. **Create Issues** (one at a time or bulk):
   - Copy issue details from ROADMAP.md
   - Set title, description, labels, milestone
   - Reference dependencies in description

## Best Practices

### Maintaining the Roadmap

1. **Single Source of Truth** - Always update ROADMAP.md first, then sync to issues
2. **Version Control** - All roadmap changes go through PR review
3. **Consistent Format** - Follow existing structure when adding issues
4. **Clear Dependencies** - Always document dependencies between issues
5. **Realistic Estimates** - Update estimates based on actual time spent

### Working with Dependencies

**Before Starting Work:**
```
1. Check issue dependencies in ROADMAP.md
2. Verify all dependency issues are closed
3. If blocked, update issue with "Blocked by #XX" label
4. Focus on unblocked work
```

**When Dependencies Change:**
```
1. Update ROADMAP.md dependency list
2. Update affected issue descriptions
3. Notify team of changes
4. Re-evaluate sprint plan if needed
```

### Cross-Release Coordination

Some work can happen in parallel:
- Release 2.1 and 2.2 can overlap (different areas)
- Release 4 can start while Release 3.2 in progress (after #121)

**Check the "Dependencies" section of each release for parallel work opportunities.**

## Quick Reference

### Issue Count by Release
- Release 1 Quality: 6 issues (#95-#100), 80 hours
- Release 2.1: 6 issues (#101-#106), 52 hours
- Release 2.2: 7 issues (#107-#113), 72 hours
- Release 3.1: 7 issues (#114-#120), 85 hours
- Release 3.2: 5 issues (#121-#125), 57 hours
- Release 4: 8 issues (#126-#133), 100 hours
- **Total: 39 issues, 446 hours**

### Priority Distribution
- CRITICAL: 6 issues (Release 1 Quality)
- HIGH: 21 issues
- MEDIUM: 9 issues
- LOW: 3 issues

### Where to Find Information

| Need to... | Look in... |
|------------|------------|
| Understand big picture | Forward Roadmap (Section 3) |
| See completed work | Release 1 Summary (Section 1) |
| Plan next sprint | Current release's Issues Table |
| Create GitHub Issue | Issue Details sections |
| Check dependencies | Issue Details "Dependencies" line |
| Set up automation | Issue Automation Strategy (Section 8) |
| Measure success | Success Metrics (Section 9) |
| Assess risks | Risk Assessment (Section 10) |

## Support

**Questions about the roadmap?**
- Check this guide first
- Review ROADMAP.md Issue Automation Strategy section
- Create a GitHub Discussion for clarification
- Tag @richardthorek in issues

**Proposing Changes:**
1. Create issue describing the change
2. Update ROADMAP.md in a branch
3. Submit PR with rationale
4. Discuss in PR review
5. Merge when approved

---

**Document Version:** 1.0  
**Last Updated:** December 27, 2024  
**Maintained by:** Fire Santa Run Development Team
