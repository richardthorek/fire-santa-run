/**
 * Client helpers for the Stripe subscription flow. These call the server, which
 * creates the Checkout / billing-portal session and returns a URL we redirect
 * to. The client never handles card data or asserts payment state.
 */

import { getApiAuthHeaders } from '../auth/apiToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function postForRedirectUrl(path: string, brigadeId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ brigadeId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
  }
  return payload.url as string;
}

/** Start Stripe Checkout for a brigade subscription and redirect the browser. */
export async function startBrigadeCheckout(brigadeId: string): Promise<void> {
  const url = await postForRedirectUrl('/stripe/create-checkout-session', brigadeId);
  window.location.assign(url);
}

/** Open the Stripe billing portal (manage / cancel) and redirect the browser. */
export async function openBillingPortal(brigadeId: string): Promise<void> {
  const url = await postForRedirectUrl('/stripe/create-portal-session', brigadeId);
  window.location.assign(url);
}
