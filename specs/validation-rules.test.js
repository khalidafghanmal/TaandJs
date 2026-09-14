import test from 'node:test';
import assert from 'node:assert/strict';
import { rules, parseRules, isEmpty, getValue } from '../engine/validation/Rules.js';
import { Validator } from '../engine/validation/Validator.js';
import { ValidationError } from '../engine/validation/ValidationError.js';
import { miniApp } from './helpers/setup.js';

test('isEmpty detects empty values', () => {
  assert.equal(isEmpty(null), true);
  assert.equal(isEmpty(''), true);
  assert.equal(isEmpty('  '), true);
  assert.equal(isEmpty([]), true);
  assert.equal(isEmpty('x'), false);
  assert.equal(isEmpty(0), false);
});

test('getValue reads nested keys', () => {
  assert.equal(getValue({ user: { email: 'a@b.c' } }, 'user.email'), 'a@b.c');
  assert.equal(getValue({}, 'missing'), undefined);
});

test('parseRules splits pipe string', () => {
  const parsed = parseRules('required|email|min:3');
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].name, 'required');
  assert.deepEqual(parsed[2].params, ['3']);
});

test('required rule', () => assert.equal(rules.required('x'), true));
test('required fails empty', () => assert.equal(rules.required(''), 'required'));
test('string rule', () => assert.equal(rules.string('hi'), true));
test('string fails number', () => assert.equal(rules.string(1), 'string'));
test('email valid', () => assert.equal(rules.email('a@b.co'), true));
test('email invalid', () => assert.equal(rules.email('bad'), 'email'));
test('min string length', () => assert.equal(rules.min('abcd', ['3']), true));
test('min string fail', () => assert.equal(rules.min('ab', ['3']), 'min'));
test('max string length', () => assert.equal(rules.max('ab', ['5']), true));
test('max string fail', () => assert.equal(rules.max('abcdef', ['3']), 'max'));
test('numeric accepts number', () => assert.equal(rules.numeric(42), true));
test('numeric accepts numeric string', () => assert.equal(rules.numeric('3.14'), true));
test('numeric rejects text', () => assert.equal(rules.numeric('x'), 'numeric'));
test('integer accepts int', () => assert.equal(rules.integer(7), true));
test('integer accepts string int', () => assert.equal(rules.integer('-2'), true));
test('integer rejects float', () => assert.equal(rules.integer('1.5'), 'integer'));
test('boolean accepts bool', () => assert.equal(rules.boolean(true), true));
test('boolean accepts 1', () => assert.equal(rules.boolean('1'), true));
test('boolean rejects junk', () => assert.equal(rules.boolean('maybe'), 'boolean'));
test('in rule', () => assert.equal(rules.in('a', ['a', 'b']), true));
test('in rule fail', () => assert.equal(rules.in('c', ['a', 'b']), 'in'));
test('not_in rule', () => assert.equal(rules.not_in('c', ['a', 'b']), true));
test('not_in fail', () => assert.equal(rules.not_in('a', ['a', 'b']), 'not_in'));
test('regex rule', () => assert.equal(rules.regex('ABC', ['^[A-Z]+$']), true));
test('regex fail', () => assert.equal(rules.regex('abc', ['^[A-Z]+$']), 'regex'));
test('confirmed rule', () => {
  const data = { password: 'secret', password_confirmation: 'secret' };
  assert.equal(rules.confirmed('secret', [], data, 'password'), true);
});
test('confirmed mismatch', () => {
  const data = { password: 'a', password_confirmation: 'b' };
  assert.equal(rules.confirmed('a', [], data, 'password'), 'confirmed');
});
test('same rule', () => {
  assert.equal(rules.same('x', ['other'], { other: 'x' }), true);
});
test('different rule', () => {
  assert.equal(rules.different('a', ['b'], { b: 'c' }), true);
});
test('array rule', () => assert.equal(rules.array([]), true));
test('array fail', () => assert.equal(rules.array({}), 'array'));
test('url rule http', () => assert.equal(rules.url('http://x.com'), true));
test('url rule fail', () => assert.equal(rules.url('ftp://x'), 'url'));
test('alpha rule', () => assert.equal(rules.alpha('Abc'), true));
test('alpha_num rule', () => assert.equal(rules.alpha_num('Abc123'), true));
test('digits rule', () => assert.equal(rules.digits('1234', ['4']), true));
test('digits fail', () => assert.equal(rules.digits('123', ['4']), 'digits'));
test('date rule valid', () => assert.equal(rules.date('2026-01-15'), true));
test('date rule invalid', () => assert.equal(rules.date('not-a-date'), 'date'));

test('nullable skips other rules when empty', async () => {
  const { validator } = miniApp();
  const data = await validator.make({ bio: '' }, { bio: 'nullable|string|min:5' });
  assert.equal(data.bio, '');
});

test('validator returns validated fields only', async () => {
  const { validator } = miniApp();
  const data = await validator.make(
    { name: 'Jane', extra: 'ignored' },
    { name: 'required|string' },
  );
  assert.deepEqual(data, { name: 'Jane' });
});

test('validator throws ValidationError', async () => {
  const { validator } = miniApp();
  await assert.rejects(
    () => validator.make({ email: 'bad' }, { email: 'required|email' }),
    ValidationError,
  );
});

test('ValidationError first message', () => {
  const err = new ValidationError({ email: ['Invalid email'] });
  assert.equal(err.first('email'), 'Invalid email');
});

test('custom callback rule', async () => {
  const { validator } = miniApp();
  const data = await validator.make(
    { code: 'OK' },
    { code: (value) => value === 'OK' || 'Invalid code' },
  );
  assert.equal(data.code, 'OK');
});

test('unknown rule throws', async () => {
  const { validator } = miniApp();
  await assert.rejects(
    () => validator.make({ x: 1 }, { x: 'notarule' }),
    /Unknown validation rule/,
  );
});

test('validator custom messages', async () => {
  const { validator } = miniApp();
  try {
    await validator.make({ email: '' }, { email: 'required' }, { required: 'Email needed' });
  } catch (err) {
    assert.equal(err.errors.email[0], 'Email needed');
  }
});

test('min numeric value', () => assert.equal(rules.min(10, ['5']), true));
test('max numeric value fail', () => assert.equal(rules.max(10, ['5']), 'max'));
