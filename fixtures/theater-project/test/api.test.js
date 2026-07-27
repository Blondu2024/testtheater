import { get, build, ping, render, deny } from '../src/api.js';

test.todo('rate limiting');

test('responds with json', async () => {
  const response = await get('/api');
  expect(response.status).toBe(200);
});

describe.skip('auth', () => {
  it('rejects bad tokens', () => {
    expect(deny('nope')).toBe(true);
  });
});

test('logs the payload', () => {
  const payload = build();
  log(payload);
});

test.only('pings', () => {
  expect(ping()).toBe('pong');
});

it('renders the dashboard', () => {
  expect(render()).toMatchSnapshot();
});
