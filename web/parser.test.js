import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeName } from './parser.js';

test('safeName strips punctuation and joins words with underscores', () => {
  assert.equal(safeName('Parque Jurásico (Z-Library)'), 'Parque_Jurásico_Z-Library');
});

test('safeName collapses multiple spaces and trims', () => {
  assert.equal(safeName('  Hábitos   atómicos  '), 'Hábitos_atómicos');
});

test('safeName keeps hyphens and underscores as-is', () => {
  assert.equal(safeName('Self-Help_Classics'), 'Self-Help_Classics');
});
