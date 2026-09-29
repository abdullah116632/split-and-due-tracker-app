import { Alert } from 'react-native';

import type { PersonInput } from '@/db/people';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s-]{6,20}$/;

export function validatePerson(raw: { name: string; phone: string; email: string }) {
  const errors: Record<string, string> = {};
  const name = raw.name.trim();
  const phone = raw.phone.trim();
  const email = raw.email.trim();

  if (!name) errors.name = 'Please enter a name.';
  else if (name.length > 60) errors.name = 'Name is too long.';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number.';
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const value: PersonInput | null =
    Object.keys(errors).length === 0 ? { name, phone: phone || null, email: email || null } : null;
  return { value, errors };
}

/**
 * Pops up the first validation message. Forms can be taller than the screen, so an inline
 * error near the top may be out of view when the user taps Save at the bottom.
 */
export function alertFirstError(errors: Record<string, string | null | undefined>): boolean {
  const message = Object.values(errors).find(Boolean);
  if (message) Alert.alert('Please check', message);
  return !!message;
}
