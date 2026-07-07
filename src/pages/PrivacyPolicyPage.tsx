/**
 * PrivacyPolicyPage — public privacy policy for Fire Santa Run.
 *
 * A location-tracking service must disclose what location data it collects,
 * how long it is kept, and who can see it. Plain-language, launch baseline.
 * Implements part of launch issue #344.
 */

import { Link } from 'react-router-dom';
// Direct import: the components barrel drags mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import './StaticPage.css';

const LAST_UPDATED = 'June 2026';

export function PrivacyPolicyPage() {
  return (
    <div className="static-page">
      <SEO
        title="Privacy Policy"
        description="How Fire Santa Run collects, uses, and protects location and personal data."
      />
      <div className="static-page__container">
        <Link to="/" className="static-page__back">← Back to home</Link>
        <h1 className="static-page__title">Privacy Policy</h1>
        <p className="static-page__updated">Last updated: {LAST_UPDATED}</p>

        <p className="static-page__intro">
          Fire Santa Run helps Australian Rural Fire Service (RFS) brigades plan and
          broadcast their community Santa runs, and lets the public follow along live.
          This policy explains what data we collect and how it is used.
        </p>

        <h2>What we collect</h2>
        <h3>Brigade members (signed in)</h3>
        <ul>
          <li>Your name and email address, provided through Microsoft Entra sign-in.</li>
          <li>Brigade membership, role, and the routes you create or operate.</li>
          <li>
            <strong>Live GPS location</strong> while you are actively broadcasting a Santa
            run. This is shared in real time so the public can follow the run.
          </li>
        </ul>
        <h3>Public viewers (no sign-in)</h3>
        <ul>
          <li>
            We do <strong>not</strong> require an account to watch a Santa run and we do
            not collect a viewer&apos;s personal GPS location.
          </li>
          <li>
            Basic, anonymised analytics (such as a count of how many people viewed a route)
            may be recorded to help brigades understand reach.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To show the live position of a Santa run to the public during the run.</li>
          <li>To let brigade admins plan routes and manage their members.</li>
          <li>To keep the service secure, reliable, and to diagnose errors.</li>
        </ul>

        <h2>Location data &amp; retention</h2>
        <p>
          A broadcasting operator&apos;s live location is transmitted only while a run is
          active and is not retained as a persistent location history after the run ends.
          Route plans (the waypoints a brigade chooses) are stored so brigades can reuse
          and review them. Completed routes are automatically archived after a
          brigade-configurable period (default 90 days).
        </p>

        <h2>Who can see your data</h2>
        <ul>
          <li>Live run location is public during the run — that is the point of the service.</li>
          <li>Member contact details and brigade administration data are visible only to
            that brigade&apos;s admins, never across brigades.</li>
          <li>We do not sell personal data or share it with advertisers.</li>
        </ul>

        <h2>Data storage &amp; security</h2>
        <p>
          Data is stored in Microsoft Azure (Australia regions where available).
          Connections are encrypted in transit (HTTPS). Access to brigade data is scoped
          per brigade and protected by authentication.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>You can stop broadcasting your location at any time by ending navigation.</li>
          <li>Brigade admins can remove members and delete routes they manage.</li>
          <li>
            To request access to, correction of, or deletion of your personal data,
            contact your brigade administrator or reach us via the details below.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be raised through your brigade administrator or
          the project maintainers. See the <Link to="/help">help page</Link> for more.
        </p>
      </div>
    </div>
  );
}
