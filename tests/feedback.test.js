import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEEDBACK_FORM_NAME, feedbackBody, feedbackErrors } from '../src/lib/feedback.js';

describe('the feedback form', () => {
  it('needs a message; the name or email is optional', () => {
    expect(feedbackErrors({ message: '  ', contact: '' })).toEqual(['Write a message first.']);
    expect(feedbackErrors({ message: 'The tax page is great', contact: '' })).toEqual([]);
    expect(feedbackErrors({ message: 'x'.repeat(5001), contact: '' })).toEqual(['Keep the message under 5,000 characters.']);
    expect(feedbackErrors({ message: 'ok', contact: 'y'.repeat(201) })).toEqual(['Keep the name or email under 200 characters.']);
  });

  it('encodes the fields the way Netlify Forms expects', () => {
    const body = new URLSearchParams(feedbackBody({ message: ' Hi & thanks ', contact: 'M.S.', page: '#/next/tax' }));
    expect(Object.fromEntries(body)).toEqual({
      'form-name': 'feedback',
      message: 'Hi & thanks',
      contact: 'M.S.',
      page: '#/next/tax',
      'bot-field': '',
    });
  });

  it('index.html holds the static form Netlify detects, with the same fields', () => {
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain(`<form name="${FEEDBACK_FORM_NAME}" data-netlify="true" netlify-honeypot="bot-field" hidden>`);
    for (const field of ['message', 'contact', 'page', 'bot-field']) expect(html).toContain(`name="${field}"`);
  });
});
