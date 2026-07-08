/**
 * TermsPage — public terms of use / acceptable use for Fire Santa Run.
 *
 * Launch baseline. Implements part of launch issue #344.
 */

import { Link } from 'react-router-dom';
// Direct import: the components barrel drags mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import './StaticPage.css';

const LAST_UPDATED = 'June 2026';

export function TermsPage() {
  return (
    <div className="static-page">
      <SEO
        title="Terms of Use"
        description="Terms and acceptable use for the Fire Santa Run service."
      />
      <div className="static-page__container">
        <Link to="/" className="static-page__back">← Back to home</Link>
        <h1 className="static-page__title">Terms of Use</h1>
        <p className="static-page__updated">Last updated: {LAST_UPDATED}</p>

        <p className="static-page__intro">
          By using Fire Santa Run you agree to these terms. The service is provided to
          support fire brigades and community organisations running Santa events and to let the
          public follow those runs.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Use the service lawfully and only for genuine brigade Santa-run activities.</li>
          <li>
            Only broadcast a location when you are authorised by your brigade to operate
            that run.
          </li>
          <li>
            Do not attempt to access another brigade&apos;s administration data, disrupt the
            service, or misuse public tracking links.
          </li>
          <li>Do not upload content (logos, names, notes) that you do not have rights to use.</li>
        </ul>

        <h2>Brigade accounts &amp; roles</h2>
        <p>
          Brigade admins are responsible for managing their members and the accuracy of
          their published routes. Roles (admin, operator, viewer) determine what each
          member can do. Admins must ensure members are genuine brigade volunteers.
        </p>

        <h2>Safety</h2>
        <p>
          Fire Santa Run is a planning and tracking aid only. Operators must always
          prioritise road rules and safe driving, and must not interact with the app while
          driving. Estimated arrival times are indicative and not guaranteed.
        </p>

        <h2>Availability</h2>
        <p>
          We aim for high availability but provide the service &quot;as is&quot; without warranty.
          Live tracking depends on mobile network coverage and GPS, which may be
          intermittent in rural areas.
        </p>

        <h2>Privacy</h2>
        <p>
          Your use of the service is also governed by our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms as the service evolves. Continued use after an update
          means you accept the revised terms.
        </p>
      </div>
    </div>
  );
}
