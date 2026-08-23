import { describe, expect, it } from 'vitest';
import { parseRoute, serializeRoute } from './routes';

const options = {
  quizIds: ['world', 'asia'],
  locationIds: ['iso:AAA', 'iso:BBB'],
  defaultQuizId: 'world',
};

describe('route contract', () => {
  it('preserves pathname, hash, and simultaneous quiz intents', () => {
    const route = parseRoute(
      '/TerraDash/?quiz=asia&select=1&start=1#focus',
      options,
    );
    expect(route).toMatchObject({
      pathname: '/TerraDash/',
      hash: '#focus',
      page: 'quiz',
      quizId: 'asia',
      select: true,
      start: true,
    });
    expect(serializeRoute(route)).toBe(
      '/TerraDash/?quiz=asia&select=1&start=1#focus',
    );
  });

  it('normalizes unknown page, quiz, and location values', () => {
    expect(
      parseRoute(
        '/TerraDash/?page=unknown&quiz=invalid&location=invalid',
        options,
      ),
    ).toMatchObject({
      page: 'quiz',
      quizId: 'world',
      locationId: 'iso:AAA',
      select: false,
      start: false,
    });
  });

  it('recognizes both diagnostics entrypoint and query routes', () => {
    expect(
      parseRoute('/TerraDash/diagnostics.html?location=iso%3ABBB', options),
    ).toMatchObject({ page: 'diagnostics', locationId: 'iso:BBB' });
    expect(
      parseRoute('/TerraDash/?page=diagnostics&location=iso%3ABBB', options),
    ).toMatchObject({ page: 'diagnostics', locationId: 'iso:BBB' });
  });
});
