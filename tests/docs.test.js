import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_ARTICLES, docsHash, docsLocation } from '../src/lib/docs.js';
import { headingSlugs, markdownToHtml } from '../src/lib/markdown.js';
import { routeFromHash } from '../src/lib/route.js';

const ROOT = join(import.meta.dirname, '..');
const article = (slug) => readFileSync(join(ROOT, 'articles', `${slug}.md`), 'utf8');

// Every file under a folder, recursively.
const filesIn = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
  );

describe('the Docs section', () => {
  it('routes #/docs and everything under it, nothing else', () => {
    expect(routeFromHash('#/docs')).toBe('docs');
    expect(routeFromHash('#/docs/inputs')).toBe('docs');
    expect(routeFromHash('#/docs/inputs/people')).toBe('docs');
    expect(routeFromHash('#/docsx')).toBe('calculator');
    expect(routeFromHash('#/how-it-works')).toBe('article');
  });

  it('reads the article and heading from the address', () => {
    expect(docsLocation('#/docs')).toEqual({ article: null, section: null });
    expect(docsLocation('#/docs/')).toEqual({ article: null, section: null });
    expect(docsLocation('#/docs/inputs')).toEqual({ article: 'inputs', section: null });
    expect(docsLocation('#/docs/inputs/age-or-birthdate')).toEqual({ article: 'inputs', section: 'age-or-birthdate' });
    // anything that isn't a plain slug is ignored
    expect(docsLocation('#/docs/<script>/x')).toEqual({ article: null, section: 'x' });
    expect(docsLocation('#/next')).toBeNull();
    expect(docsHash('inputs')).toBe('#/docs/inputs');
    expect(docsHash('inputs', 'Age or birthdate')).toBe('#/docs/inputs/age-or-birthdate');
  });

  it('has a file for every listed article, and lists every file', () => {
    const files = readdirSync(join(ROOT, 'articles')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
    expect(files.sort()).toEqual(DOCS_ARTICLES.map((a) => a.slug).sort());
    for (const { slug } of DOCS_ARTICLES) expect(article(slug)).toMatch(/^# /);
  });

  it('every link to a Docs article or heading, in the articles and the code, exists', () => {
    const sources = [...filesIn('articles'), ...filesIn('src')].map((f) => readFileSync(join(ROOT, f), 'utf8'));
    const links = sources.flatMap((text) => [...text.matchAll(/#\/docs\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/g)]);
    for (const [link, slug, section] of links) {
      expect(DOCS_ARTICLES.map((a) => a.slug), link).toContain(slug);
      if (section) expect(headingSlugs(article(slug)), link).toContain(section);
    }
  });

  it('gives each heading an id', () => {
    expect(markdownToHtml('# Title\n\n## Age or birthdate\n\nText.')).toContain('<h2 id="age-or-birthdate">Age or birthdate</h2>');
    expect(headingSlugs('# The household inputs\n\n### Social Security\ntext\n')).toEqual(['the-household-inputs', 'social-security']);
  });
});
