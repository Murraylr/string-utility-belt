/**
 * Sends one of the events the site counts (src/lib/countedEvents.ts) to the Worker.
 * Fire and forget: `sendBeacon` still delivers when the click leaves the page, and a
 * failure is never the visitor's problem. Only the production site counts, and never a
 * browser driven by automation (E2E runs, crawlers that click).
 */
import { EVENT_INTEGRATIONS, EVENT_PATH, type CountedEvent } from '@/lib/countedEvents'
import type { IntegrationId } from '@/app/integrations/links'

export type { CountedEvent }

export const PRODUCTION_HOSTS: readonly string[] = ['stringutilitybelt.com', 'www.stringutilitybelt.com']

// every integration the header links to can be counted, and nothing else
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const integrationsMatch: Same<(typeof EVENT_INTEGRATIONS)[number], IntegrationId> = true
void integrationsMatch

/** Whether a page on `hostname` counts events: the production site, not driven by automation. */
export function counts(hostname: string, webdriver: boolean | undefined): boolean {
  return PRODUCTION_HOSTS.includes(hostname) && !webdriver
}

export function countEvent(event: CountedEvent): void {
  if (typeof window !== 'undefined' && counts(window.location.hostname, navigator.webdriver)) sendEvent(event)
}

/** The transport alone, wherever the page is (`countEvent` decides whether to call it). */
export function sendEvent(event: CountedEvent): void {
  const body = JSON.stringify(event)
  try {
    if (navigator.sendBeacon?.(EVENT_PATH, new Blob([body], { type: 'application/json' }))) return
  } catch { /* no beacon in this browser: fall back to fetch */ }
  fetch(EVENT_PATH, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    credentials: 'omit',
  }).catch(() => { /* a lost count is not worth the visitor's attention */ })
}
