/**
 * PrivacyPolicyPage — public privacy policy for Fire Santa Run.
 *
 * Written from what the app actually does (server/src/routes/analytics.ts,
 * server/src/realtime/hub.ts, server/src/utils/push.ts, infra/main.bicep).
 * Anything marked TO CONFIRM must be checked before publishing. This is a
 * plain-language draft and has not had legal review.
 */

import { Link } from 'react-router-dom';
// Direct import: the components barrel drags mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import './StaticPage.css';

const LAST_UPDATED = '2 November 2026';

export function PrivacyPolicyPage() {
  return (
    <div className="static-page">
      <SEO
        title="Privacy Policy"
        description="What Fire Santa Run collects, why, who can see it, and how long we keep it."
      />
      <div className="static-page__container">
        <Link to="/" className="static-page__back">← Back to home</Link>
        <h1 className="static-page__title">Privacy Policy</h1>
        <p className="static-page__updated">Last updated: {LAST_UPDATED}</p>

        <p className="static-page__intro">
          Fire Santa Run helps fire brigades and community groups plan Santa runs, broadcast
          them live, and let the public follow along. This policy describes what we collect
          and why. We have tried to collect as little as possible.
        </p>

        <h2>Who collects what</h2>

        <h3>Brigade members and organisers (signed in)</h3>
        <ul>
          <li>
            Your name and email address, from your Station Kit sign-in. Station Kit also holds
            your organisation&apos;s subscription details; Fire Santa Run only receives whether
            it is switched on for your organisation.
          </li>
          <li>Your brigade role, and the routes and comments you create or edit. Edits record your name and the time.</li>
          <li>
            <strong>Live GPS location</strong>, only while you are broadcasting an active run.
            It is shown publicly on the tracking page during the run.
          </li>
          <li>Logos and text you enter for your brigade and routes, which are checked for inappropriate content.</li>
        </ul>

        <h3>Public viewers (no sign-in)</h3>
        <ul>
          <li>You do not need an account to follow a run, and we do not collect your GPS location.</li>
          <li>
            For each visit we record a random session ID, when you arrived and left, how long
            you watched, and how you found the page (for example QR code, a direct link or a
            social share). Brigades see these as view counts and peak viewers. We do not record
            your IP address, your device or browser details, or your name.
          </li>
          <li>
            <strong>Sharing a waiting spot is optional.</strong> On a live tracking page you can
            choose to let the crew know roughly where you are waiting. Your position is rounded to
            about 100&nbsp;m on your device, is held in memory only while the run is live, and is
            never written to storage. The brigade sees it only as a group: a spot appears only when
            at least three viewers share the same area. Turning it off or closing the page removes it.
          </li>
          <li>
            If you allow notifications for a run, we store your browser&apos;s push subscription
            (an endpoint address and two encryption keys) so we can send the &ldquo;Santa is on
            the way&rdquo; message. Remove it by turning notifications off in your browser.
          </li>
        </ul>

        <h2>Live location</h2>
        <p>
          A broadcasting device&apos;s location is sent to our servers and passed to viewers while
          the run is active. It is held in memory and is not saved as a location history. When the
          run ends, the last known position is discarded.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To show the live position of a run and its route to the public.</li>
          <li>To let brigade organisers plan routes and manage members and comments.</li>
          <li>To send run plans by email, and to send the start-of-run notification to people who opted in.</li>
          <li>To keep the service secure and reliable, and to find and fix errors.</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We use these service providers. Each handles data only to provide its part of the service.</p>
        <ul>
          <li><strong>Microsoft Azure</strong> (Australia East) hosts the app, the database and file storage.</li>
          <li><strong>Station Kit</strong> handles sign-in, organisation subscriptions and billing.</li>
          <li><strong>Mapbox</strong> provides the maps. Your browser contacts Mapbox directly to load them, so Mapbox receives your IP address as part of normal map loading.</li>
          <li><strong>Azure Communication Services</strong> sends run-plan and operations emails.</li>
          <li><strong>Azure AI Content Safety</strong> checks brigade names, logos and text for inappropriate content.</li>
          <li>
            <strong>Microsoft Application Insights</strong> stores error and performance logs, which include your browser type.
            {/* TO CONFIRM: whether App Insights records client IP addresses and, if so, that IP masking is on */}
          </li>
          <li>
            <strong>Browser push services</strong> (for example Google, Apple or Mozilla, depending on
            your browser) deliver notifications you have allowed.
          </li>
        </ul>
        <p>
          We do not sell personal information and we do not use it for advertising.
        </p>

        <h2>Who can see your data</h2>
        <ul>
          <li>Live location and the route are public while a run is live. That is the point of the service.</li>
          <li>Waiting-spot information is visible only to the brigade running that route, only during the run, and only as a group.</li>
          <li>Viewer statistics (counts, durations, how people arrived) are visible only to that brigade&apos;s organisers.</li>
          <li>Member details, comments and brigade administration are visible only to that brigade, never across brigades.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Live location: only for the duration of the run.</li>
          <li>Waiting spots: only for the duration of the run.</li>
          <li>
            Routes: a route not used for 90 days is archived automatically. Brigades can change
            this period. Archived routes are kept until a brigade deletes them.
            {/* TO CONFIRM: retention for viewer statistics and error logs */}
          </li>
          <li>Push subscriptions: until you turn notifications off or your browser retires them.</li>
        </ul>

        <h2>Storage &amp; security</h2>
        <p>
          Data is stored in Microsoft Azure in Australia (Australia East). All connections use HTTPS.
          Brigade data is separated by brigade and requires sign-in to read or change.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Stop sharing your location at any time by ending navigation or closing the tracking page.</li>
          <li>Turn off the waiting spot, or turn off notifications in your browser.</li>
          <li>Brigade organisers can remove members, comments and routes.</li>
          <li>To ask what we hold about you, or to have it corrected or deleted, contact us below.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          {/* TO CONFIRM: a monitored privacy contact address before publishing */}
          For privacy questions and requests, contact <strong>[privacy contact to be confirmed]</strong>.
          You can also raise questions through your brigade administrator or the{' '}
          <Link to="/help">help page</Link>.
        </p>
      </div>
    </div>
  );
}
