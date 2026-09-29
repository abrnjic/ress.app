import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPaymentDate, monthOfDate, validateNewPayment } from '../src/lib/payment-validation.ts';

test('new payment date follows selected month without touching existing dates', () => {
  const today = new Date(2026, 8, 29, 10);
  assert.equal(defaultPaymentDate('2026-09', today), today);
  const historical = defaultPaymentDate('2024-02', today);
  assert.equal(monthOfDate(historical), '2024-02');
  assert.equal(historical.getDate(), 1);
  assert.equal(today.getDate(), 29);
});
test('rejects mismatched month, year and invalid dates', () => {
  for (const date of [new Date(2026, 7, 31), new Date(2025, 8, 1), new Date(NaN), null]) {
    assert.notEqual(validateNewPayment('Test', 100, date, '2026-09'), '');
  }
});
test('accepts leap day and local midnight without UTC month drift', () => {
  assert.equal(validateNewPayment('Test', 100, new Date(2024, 1, 29), '2024-02'), '');
  assert.equal(validateNewPayment('Test', 0.01, new Date(2026, 8, 1, 0, 5), '2026-09'), '');
});
test('rejects missing names and invalid amounts', () => {
  const date = new Date(2026, 8, 1);
  for (const amount of [0, -1, NaN, Infinity]) assert.notEqual(validateNewPayment('Test', amount, date, '2026-09'), '');
  assert.notEqual(validateNewPayment('  ', 1, date, '2026-09'), '');
  assert.equal(validateNewPayment('Postojeće IME', 123.45, date, '2026-09'), '');
});

test('legacy uppercase and title-case reseller names can be read without changing stored names', async () => {
  const { resellerNameVariants } = await import('../src/lib/reseller-names.ts');
  const name = 'ČOVIK RESS';
  const variants = resellerNameVariants(name);
  assert.ok(variants.includes(name));
  assert.ok(variants.includes('Čovik Ress'));
  assert.ok(!variants.includes('Covik Ress'));
  assert.equal(name, 'ČOVIK RESS');
  assert.equal(new Set(variants).size, variants.length);
});
