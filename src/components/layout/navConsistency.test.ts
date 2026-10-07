import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The sidebar deep-links into a section with ?tab=<leaf>, and the section page
// declares the leaves it answers for. A typo on either side is silent at build
// time and shows up only as a tab that quietly opens the wrong thing, so the
// two lists are checked against each other here.
//
// Both are read from source rather than imported: the sidebar pulls in the
// auth and language providers, which would mean standing up Supabase to assert
// a list of strings.
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/** every `key: "x"` inside a section page's leaf registry */
function pageLeafKeys(path: string): string[] {
  const src = read(path);
  return [...src.matchAll(/^\s*key: '([a-z0-9-]+)',$/gm)].map(m => m[1]);
}

/** the children the sidebar declares under a given section path */
function sidebarChildKeys(sectionPath: string): string[] {
  const src = read('src/components/layout/Sidebar.tsx');
  const start = src.indexOf(`path: "${sectionPath}"`);
  expect(start, `sidebar has no entry for ${sectionPath}`).toBeGreaterThan(-1);
  // up to the start of the next nav item, or the end of the list
  const rest = src.slice(start);
  const end = rest.indexOf('\n  {\n', 1);
  const block = end === -1 ? rest : rest.slice(0, end);
  return [...block.matchAll(/\{ key: "([a-z0-9-]+)"/g)].map(m => m[1]);
}

const SECTIONS: Array<[path: string, page: string]> = [
  ['/products', 'src/pages/ProductsPage.tsx'],
  ['/sales', 'src/pages/SalesPage.tsx'],
  ['/team', 'src/pages/TeamPage.tsx'],
  ['/settings', 'src/pages/SettingsPage.tsx'],
];

describe('sidebar deep links', () => {
  it.each(SECTIONS)('%s links only to leaves its page declares', (path, page) => {
    const leaves = pageLeafKeys(page);
    expect(leaves.length).toBeGreaterThan(0);
    for (const child of sidebarChildKeys(path)) {
      expect(leaves, `${path}?tab=${child}`).toContain(child);
    }
  });

  it.each(SECTIONS)('%s offers every leaf its page declares', (path, page) => {
    const children = sidebarChildKeys(path);
    for (const leaf of pageLeafKeys(page)) {
      expect(children, `${path}?tab=${leaf} is unreachable from the sidebar`).toContain(leaf);
    }
  });

  it('keeps the nine sections, and no more', () => {
    const src = read('src/components/layout/Sidebar.tsx');
    const list = src.slice(src.indexOf('const navItems'), src.indexOf('export function Sidebar'));
    const paths = [...list.matchAll(/path: "([^"]+)"/g)].map(m => m[1]);
    expect(paths).toEqual([
      '/', '/products', '/sales', '/shipping', '/reports',
      '/team', '/ai-insights', '/subscription', '/settings',
    ]);
  });
});
