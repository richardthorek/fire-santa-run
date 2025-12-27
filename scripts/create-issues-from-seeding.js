#!/usr/bin/env node
/**
 * Create GitHub issues from docs/issue-seeding.md using the GitHub CLI.
 *
 * Usage:
 *   GH_TOKEN=ghp_... node scripts/create-issues-from-seeding.js
 *   GH_TOKEN=ghp_... node scripts/create-issues-from-seeding.js --dry-run  # prints commands only
 *
 * Requirements:
 *   - GitHub CLI (`gh`) authenticated with repo issue write permissions
 *   - docs/issue-seeding.md present with the staged issue content
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

const dryRun = process.argv.includes('--dry-run');
const seedingPath = join(process.cwd(), 'docs', 'issue-seeding.md');

const markdown = readFileSync(seedingPath, 'utf8');
const lines = markdown.split('\n');
const issues = [];

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i].trim();
  const titleMatch =
    line.match(/^### (?:Parent Issue: |Issue: )(.*)$/) ||
    line.match(/^#### Issue .*?: (.*)$/);

  if (!titleMatch) continue;

  const title = titleMatch[1].trim();
  let labels = [];
  let body = '';

  // Find labels and body starting from the next line
  let j = i + 1;
  for (; j < lines.length; j += 1) {
    const current = lines[j].trim();
    const labelMatch = current.match(/^\*\*Labels:\*\*\s*(.+)$/);
    if (labelMatch) {
      labels = labelMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (current.startsWith('**Body:**')) {
      break;
    }
  }

  // Parse body fenced block
  if (j < lines.length && lines[j].includes('**Body:**')) {
    j += 1; // expect opening fence
    if (lines[j] && lines[j].trim().startsWith('```')) {
      j += 1; // move past opening ```
      const bodyLines = [];
      for (; j < lines.length; j += 1) {
        if (lines[j].trim().startsWith('```')) break;
        bodyLines.push(lines[j]);
      }
      body = bodyLines.join('\n').trim();
    }
  }

  if (!body) {
    console.warn(`Skipping '${title}' (no body found)`);
    continue;
  }

  issues.push({ title, labels, body });
}

if (!issues.length) {
  console.error('No issues parsed from docs/issue-seeding.md');
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'fsr-issues-'));
console.log(`Staging ${issues.length} issues...`);

for (let idx = 0; idx < issues.length; idx += 1) {
  const issue = issues[idx];
  const bodyPath = join(tempDir, `issue-${idx + 1}.md`);
  writeFileSync(bodyPath, issue.body, 'utf8');

  const args = ['issue', 'create', '--title', issue.title, '--body-file', bodyPath];
  if (issue.labels.length) {
    args.push('--label', issue.labels.join(','));
  }

  if (dryRun) {
    console.log('[dry-run] gh', args.join(' '));
    continue;
  }

  const result = spawnSync('gh', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Failed to create issue: ${issue.title}`);
    rmSync(tempDir, { recursive: true, force: true });
    process.exit(result.status || 1);
  }
}

rmSync(tempDir, { recursive: true, force: true });
console.log('Done.');
