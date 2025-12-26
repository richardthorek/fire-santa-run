/**
 * SEO component for dynamic meta tags
 * Implements Open Graph and Twitter Card tags for social media previews
 * 
 * Uses React 19's native document metadata support - no external dependencies required.
 * React 19 automatically hoists <title>, <meta>, and <link> tags to the document <head>.
 */

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image';
}

const DEFAULT_TITLE = 'Fire Santa Run';
const DEFAULT_DESCRIPTION = 'Track Santa in real-time as your local Rural Fire Service brings Christmas joy to your community. Plan routes, share tracking links, and spread holiday cheer!';
const DEFAULT_IMAGE = `${window.location.origin}/og-image.svg`;
const DEFAULT_SITE_NAME = 'Fire Santa Run';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url = window.location.href,
  type = 'website',
  siteName = DEFAULT_SITE_NAME,
  twitterCard = 'summary_large_image',
}: SEOProps) {
  const fullTitle = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;

  return (
    <>
      {/* Basic Meta Tags - React 19 automatically hoists to <head> */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph Tags (Facebook, LinkedIn) */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Additional SEO Tags */}
      <meta name="theme-color" content="#D32F2F" />
      <link rel="canonical" href={url} />
    </>
  );
}
