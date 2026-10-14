/**
 * Which URLs are the SAME page for the transition: switching a tab inside a page (fleet tabs, Master Data tabs, Settings tabs) must not replay the page animation,
 * while a list -> detail change (robots -> one robot) must.
 */
export function pageKey(pathname: string): string {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return p.replace(/^(\/configurator\/fleets\/[^/]+)\/.*$/, '$1').replace(/^(\/configurator\/master-data)\/.*$/, '$1').replace(/^(\/(?:configurator|supervisor)\/settings)\/.*$/, '$1');
}
