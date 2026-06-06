/**
 * OnboardingChecklist — getting-started banner shown to new brigade admins.
 *
 * Displayed in the Dashboard when the brigade admin has not yet dismissed it.
 * Tracks completion of the three essential first steps and stores the
 * dismissed state in localStorage so it only shows once.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Brigade } from '../storage/types';
import type { Route } from '../types';
import './OnboardingChecklist.css';

export interface OnboardingChecklistProps {
  brigade: Brigade;
  routes: Route[];
}

function storageKey(brigadeId: string) {
  return `brigade_onboarding_dismissed_${brigadeId}`;
}

function isDismissed(brigadeId: string): boolean {
  try {
    return localStorage.getItem(storageKey(brigadeId)) === 'true';
  } catch {
    return false;
  }
}

function dismiss(brigadeId: string) {
  try {
    localStorage.setItem(storageKey(brigadeId), 'true');
  } catch {
    // Storage full or blocked — silently ignore
  }
}

interface Step {
  id: string;
  label: string;
  done: boolean;
  cta: { label: string; to: string };
}

function buildSteps(brigade: Brigade, routes: Route[]): Step[] {
  const profileComplete = Boolean(
    brigade.logo || brigade.contact?.email || brigade.contact?.website,
  );
  const hasRoute = routes.some(
    (r) => r.status === 'published' || r.status === 'active' || r.status === 'completed',
  );

  return [
    {
      id: 'profile',
      label: 'Set up your brigade profile (logo, contact details)',
      done: profileComplete,
      cta: { label: 'Open settings', to: `/dashboard/${brigade.id}/settings` },
    },
    {
      id: 'route',
      label: 'Create and publish your first Santa run route',
      done: hasRoute,
      cta: { label: 'Create route', to: '/routes/new' },
    },
    {
      id: 'share',
      label: 'Share your brigade page with your community',
      done: false, // Always actionable — can't detect externally
      cta: { label: 'View your page', to: `/brigade/${brigade.slug}` },
    },
  ];
}

export function OnboardingChecklist({ brigade, routes }: OnboardingChecklistProps) {
  const [visible, setVisible] = useState(!isDismissed(brigade.id));

  const handleDismiss = useCallback(() => {
    dismiss(brigade.id);
    setVisible(false);
  }, [brigade.id]);

  if (!visible) return null;

  const steps = buildSteps(brigade, routes);
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <div className="onb" role="region" aria-label="Getting started checklist">
      <div className="onb__header">
        <div className="onb__title-row">
          <span className="onb__emoji" aria-hidden="true">
            {allDone ? '🎉' : '🎄'}
          </span>
          <div>
            <h2 className="onb__title">
              {allDone ? 'You’re all set for launch!' : 'Getting started'}
            </h2>
            <p className="onb__subtitle">
              {completedCount} of {steps.length} steps complete
            </p>
          </div>
        </div>
        <button
          type="button"
          className="onb__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss getting started checklist"
        >
          ✕
        </button>
      </div>

      <div className="onb__progress-bar" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={steps.length}>
        <div
          className="onb__progress-fill"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="onb__steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`onb__step ${step.done ? 'onb__step--done' : ''}`}
          >
            <span className="onb__step-icon" aria-hidden="true">
              {step.done ? '✅' : '⬜'}
            </span>
            <span className="onb__step-label">{step.label}</span>
            {!step.done && (
              <Link to={step.cta.to} className="onb__step-cta">
                {step.cta.label} →
              </Link>
            )}
          </li>
        ))}
      </ol>

      {allDone && (
        <div className="onb__all-done">
          <p>🎅 Your brigade is ready for Santa season! Dismiss this checklist when you&apos;re done.</p>
          <button
            type="button"
            className="onb__btn"
            onClick={handleDismiss}
          >
            Got it, thanks!
          </button>
        </div>
      )}
    </div>
  );
}
