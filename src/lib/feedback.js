// The "Send feedback" form (round 2, "throughout"), sent through Netlify Forms: Netlify finds the
// form named "feedback" in index.html when the site is built, then accepts posts to the site with
// form-name=feedback, emails each one, and lists them in its dashboard (no sign-in, no backend of
// ours, and submissions cost no Netlify credits). Pure: checking and encoding the fields.
//
// Spam: "bot-field" is a honeypot, hidden from people; Netlify drops any submission that fills it.

export const FEEDBACK_FORM_NAME = 'feedback';
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_CONTACT_LENGTH = 200;

// -> a list of problems to show (empty when the message can be sent).
export function feedbackErrors({ message, contact }) {
  const errors = [];
  const text = String(message ?? '').trim();
  if (text === '') errors.push('Write a message first.');
  if (text.length > MAX_MESSAGE_LENGTH) errors.push(`Keep the message under ${MAX_MESSAGE_LENGTH.toLocaleString('en-US')} characters.`);
  if (String(contact ?? '').trim().length > MAX_CONTACT_LENGTH) errors.push(`Keep the name or email under ${MAX_CONTACT_LENGTH} characters.`);
  return errors;
}

// The fields as the url-encoded body Netlify Forms expects. page: where it was sent from.
export function feedbackBody({ message, contact, page, botField = '' }) {
  return new URLSearchParams({
    'form-name': FEEDBACK_FORM_NAME,
    message: String(message ?? '').trim(),
    contact: String(contact ?? '').trim(),
    page: String(page ?? ''),
    'bot-field': botField,
  }).toString();
}
