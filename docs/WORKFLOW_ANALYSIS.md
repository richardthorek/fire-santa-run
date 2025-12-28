# GitHub Actions Workflow Analysis and Recommendations

## Current Workflow Structure

### 1. Azure Static Web Apps CI/CD (`azure-static-web-apps-victorious-beach-0d2b6dc00.yml`)
**Purpose:** Deploy to Azure Static Web Apps
**Triggers:** Push to main, PRs to main
**Key Steps:**
- Checkout code
- Setup Node.js 22.x
- Install dependencies (`npm ci`)
- Build and deploy to Azure (includes API build via Oryx)

### 2. Accessibility Audit (`accessibility.yml`)
**Purpose:** Run accessibility tests
**Triggers:** Push to main, PRs to main
**Key Steps:**
- Checkout code
- Setup Node.js 20 (⚠️ inconsistent with other workflows)
- Install dependencies (`npm ci`)
- Run accessibility tests (`npm run test:a11y`)
- Run all tests with coverage (`npm run test:coverage`)
- Build project
- Upload coverage to Codecov

### 3. Test Coverage (`test-coverage.yml`)
**Purpose:** Run tests and report coverage
**Triggers:** Push to main, PRs to main
**Key Steps:**
- Checkout code
- Setup Node.js 22.x
- Install dependencies (`npm ci`)
- Run tests with coverage (`npm run test:coverage`)
- Upload coverage to Codecov
- Comment coverage on PR

## Issues Identified

### Redundancy Problems
1. **Duplicate test runs**: Both `accessibility.yml` and `test-coverage.yml` run `npm run test:coverage`
2. **Duplicate dependency installation**: All three workflows run `npm ci` independently
3. **Inconsistent Node.js versions**: accessibility uses v20, others use v22
4. **Duplicate coverage uploads**: Both accessibility and test-coverage upload to Codecov
5. **Multiple builds**: Accessibility workflow builds the project unnecessarily

### Resource Waste
- Running the same tests multiple times in parallel wastes CI minutes
- Installing dependencies 3 times for the same commit wastes time and bandwidth
- Multiple coverage reports create confusion about which is authoritative

## Recommendation: Keep Separate but Streamline

### Why Keep Separate?
1. **Different purposes**: Deployment vs. quality checks serve different needs
2. **Different triggers**: Deployment needs environment secrets, tests don't
3. **Deployment gating**: Quality checks should block PRs, deployment shouldn't
4. **Faster feedback**: Tests can fail fast without waiting for deployment
5. **Clarity**: Separate workflows make it clear what failed (tests vs. deployment)

### Proposed Structure

#### Workflow 1: CI - Quality Checks (new combined workflow)
**File:** `.github/workflows/ci.yml`
**Purpose:** Run all quality checks (tests, coverage, accessibility, linting)
**Triggers:** Push to main, PRs to main
**Jobs:**
```yaml
jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js 22.x
      - Install dependencies (npm ci)
      - Run lint (npm run lint)
      - Run tests with coverage (npm run test:coverage) # includes a11y tests
      - Upload coverage to Codecov
      - Comment coverage on PR
      - Build project (validate build works)
```

**Benefits:**
- Single dependency installation
- Tests run once
- One coverage report (authoritative)
- Consistent Node.js version
- Faster feedback (no redundant runs)

#### Workflow 2: CD - Azure Deployment (keep existing)
**File:** `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`
**Purpose:** Deploy to Azure Static Web Apps
**Triggers:** Push to main (only after quality checks pass), PRs for preview
**Keep as-is with dependency on quality checks:**
```yaml
jobs:
  build_and_deploy_job:
    needs: [quality-checks] # Optional: only if we want to block deployment
    # ... rest stays the same
```

**Benefits:**
- Focused on deployment only
- Environment secrets isolated
- Can run preview deployments for PRs
- Deployment won't run if tests fail (if we add `needs`)

## Action Plan

1. **Create new combined CI workflow** that merges accessibility and test-coverage
2. **Remove redundant workflows** (accessibility.yml, test-coverage.yml)
3. **Optionally add dependency** from deployment to CI (needs: [quality-checks])
4. **Standardize Node.js version** to 22.x everywhere
5. **Update .gitignore** to exclude TypeScript build artifacts

## Migration Notes

- The new CI workflow should maintain all existing functionality
- PR comments for coverage will continue to work
- Codecov integration will be preserved (single upload is better)
- Accessibility tests are already part of the test suite, no need for separate workflow
- The deployment workflow auto-creates issues on failure (keep this)
