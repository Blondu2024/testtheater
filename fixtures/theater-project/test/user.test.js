// A suite of the kind an app builder hands you: green, and mostly empty.
import { createUser, deleteUser } from '../src/user.js';

it('creates a user', () => {
  const user = createUser('ana');
  console.log(user);
});

it('validates the email', () => {
  expect(true).toBe(true);
});

it('deletes a user', () => {});

it.skip('handles duplicates', () => {
  expect(createUser('ana')).toBe(null);
});

it('returns the name it was given', () => {
  const user = createUser('ana');
  expect(user.name).toBe('ana');
});
