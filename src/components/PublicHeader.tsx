/**
 * PublicHeader — slim navigation bar for public, unauthenticated pages.
 *
 * Public visitors arrive deep-linked (brigade profiles, discovery, help) and
 * previously had no way to move around the site. Keeps public pages from
 * being dead ends without the weight of the authenticated AppHeader.
 */

import { Link } from 'react-router-dom';
import './PublicHeader.css';

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header__inner">
        <Link to="/" className="public-header__brand" aria-label="Fire Santa Run home">
          <span aria-hidden="true">🎅</span>
          <span className="public-header__brand-text">Fire Santa Run</span>
        </Link>
        <nav className="public-header__nav" aria-label="Public">
          <Link to="/brigades" className="public-header__link">
            🚒 Find a brigade
          </Link>
          <Link to="/help" className="public-header__link">
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
