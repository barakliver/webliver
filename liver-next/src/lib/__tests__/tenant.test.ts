import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenantOf, cleanHost, isLocal, lookupKey, platformRoot } from '../tenant.ts';

const ROOT = 'liverproduction.com';

test('a host header is not a hostname until the port and the www come off', () => {
  assert.equal(cleanHost('WWW.Example.COM:3000'), 'example.com');
  assert.equal(cleanHost(null), '');
  assert.equal(cleanHost('  Example.com  '), 'example.com');
});

test('development is never a tenant', () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]', 'app.local', 'x.localhost', '10.0.0.4']) {
    assert.equal(isLocal(h), true, h);
    assert.deepEqual(tenantOf(h, ROOT), { kind: 'platform' });
  }
});

test('the platform root and its www are the platform', () => {
  assert.deepEqual(tenantOf(ROOT, ROOT), { kind: 'platform' });
  assert.deepEqual(tenantOf('www.' + ROOT, ROOT), { kind: 'platform' });
});

test('a producer subdomain resolves by its label', () => {
  assert.deepEqual(tenantOf('keren.' + ROOT, ROOT), { kind: 'slug', value: 'keren' });
  assert.deepEqual(tenantOf('KEREN.' + ROOT + ':443', ROOT), { kind: 'slug', value: 'keren' });
});

test('the platform keeps its own subdomains', () => {
  /* A producer whose slug is "app" must not answer on the platform's own app
     subdomain, which is exactly the collision this list exists for. */
  for (const label of ['app', 'api', 'admin', 'staging', 'preview']) {
    assert.deepEqual(tenantOf(`${label}.${ROOT}`, ROOT), { kind: 'platform' }, label);
  }
});

test('a typo with two labels is not routed to whoever owns the first one', () => {
  assert.deepEqual(tenantOf('keren.old.' + ROOT, ROOT), { kind: 'platform' });
});

test("a producer's own domain resolves whole, not by its first label", () => {
  assert.deepEqual(
    tenantOf('events.keren-weddings.com', ROOT),
    { kind: 'domain', value: 'events.keren-weddings.com' },
  );
  assert.deepEqual(
    tenantOf('www.keren-weddings.com', ROOT),
    { kind: 'domain', value: 'keren-weddings.com' },
  );
});

test('with no root configured nothing is a tenant', () => {
  /* Which is the state this ships in. Reading every host as a tenant before
     anybody has set a root domain would send the platform's own site through
     a lookup that returns nothing. */
  assert.deepEqual(tenantOf('anything.example.com', ''), { kind: 'platform' });
  assert.equal(platformRoot(undefined), '');
  assert.equal(platformRoot('WWW.Example.com '), 'example.com');
});

test('the lookup key is the whole host for a domain and the label for a slug', () => {
  assert.equal(lookupKey(tenantOf('keren.' + ROOT, ROOT)), 'keren');
  assert.equal(lookupKey(tenantOf('events.keren-weddings.com', ROOT)), 'events.keren-weddings.com');
  assert.equal(lookupKey({ kind: 'platform' }), null);
});
