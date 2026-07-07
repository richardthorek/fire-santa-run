/**
 * HelpPage — short public "how to track Santa" guide for families and viewers.
 *
 * Implements part of launch issue #344.
 */

import { Link } from 'react-router-dom';
// Direct import: the components barrel drags mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import './StaticPage.css';

export function HelpPage() {
  return (
    <div className="static-page">
      <SEO
        title="How to Track Santa"
        description="A quick guide for families on how to follow your local RFS brigade's Santa run live."
      />
      <div className="static-page__container">
        <Link to="/" className="static-page__back">← Back to home</Link>
        <h1 className="static-page__title">🎅 How to Track Santa</h1>
        <p className="static-page__intro">
          Following your local Rural Fire Service Santa run is free and easy — no app
          download or sign-in required.
        </p>

        <h2>Follow along in four steps</h2>
        <div className="help-steps">
          <div className="help-step">
            <div className="help-step__num">1</div>
            <div className="help-step__body">
              <h3>Find your brigade</h3>
              <p>
                Browse the <Link to="/brigades">list of brigades</Link> and open your local
                one, or use the tracking link your brigade shared on social media.
              </p>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step__num">2</div>
            <div className="help-step__body">
              <h3>Open the live run</h3>
              <p>
                On your brigade&apos;s page, tap an upcoming or live run. When Santa is out,
                you&apos;ll see the truck moving on the map in real time.
              </p>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step__num">3</div>
            <div className="help-step__body">
              <h3>Watch Santa approach</h3>
              <p>
                The map shows Santa&apos;s current position and the planned stops. Keep the
                page open to see the truck get closer to your street.
              </p>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step__num">4</div>
            <div className="help-step__body">
              <h3>Head outside &amp; wave!</h3>
              <p>
                When Santa is nearby, head out to your front yard to wave hello. 🎄
              </p>
            </div>
          </div>
        </div>

        <h2>Tips</h2>
        <ul>
          <li>Tracking works best on a phone with a stable internet connection.</li>
          <li>Runs only appear live while the brigade is actively broadcasting.</li>
          <li>Times shown are estimates — Santa may speed up or slow down along the way.</li>
        </ul>

        <h2>Are you a brigade volunteer?</h2>
        <p>
          If you&apos;d like to plan and broadcast a run for your brigade, head to the{' '}
          <Link to="/">home page</Link> to sign in or claim your brigade.
        </p>
      </div>
    </div>
  );
}
