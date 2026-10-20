import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let stored = null;
let user = { id: 'admin-user' };
let role = 'admin';
const db = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from(table) {
    let values, expected;
    let action = 'read';
    const query = {
      eq(key, value) { if (key === 'pin_hash') expected = value; return query; },
      update(value) { action = 'update'; values = value; return query; },
      insert(value) { action = 'insert'; values = value; return query; },
      select() {
        if (action === 'read') return query;
        if ((action === 'insert' && stored) || (action === 'update' && stored?.pin_hash !== expected)) return Promise.resolve({ data: [], error: null });
        stored = values;
        return Promise.resolve({ data: [{ id: 1 }], error: null });
      },
      async maybeSingle() { return { data: stored, error: null }; },
      async single() { return { data: { role, active: true }, error: null }; },
    };
    return query;
  },
};
function load(file, overrides = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => overrides[name] || require(name), m, m.exports);
  return m.exports;
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.MANAGER_PIN = '1234';
const service = load('lib/manager-pin-server.ts', { '@supabase/supabase-js': { createClient: () => db } });
const overrides = { '@/lib/manager-pin-server': service };
const change = load('app/api/manager-pin/change/route.ts', overrides).POST;
const verify = load('app/api/manager-pin/verify/route.ts', overrides).POST;
let sequence = 0;
function req(body, token = true) { return new Request('http://localhost/api/manager-pin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${++sequence}`, ...(token ? { Authorization: 'Bearer test-session' } : {}) }, body: JSON.stringify(body) }); }
assert.equal((await change(req({ currentPin: '1234', newPin: '9876' }, false))).status, 401);
role = 'cashier';
assert.equal((await change(req({ currentPin: '1234', newPin: '9876' }))).status, 403);
role = 'admin';
assert.equal((await change(req({ currentPin: '0000', newPin: '9876' }))).status, 401);
assert.equal(stored, null);
assert.equal((await change(req({ currentPin: '1234', newPin: '9876' }))).status, 200);
assert.ok(!JSON.stringify(stored).includes('9876'));
assert.equal((await verify(req({ pin: '1234' }))).status, 401);
assert.equal((await verify(req({ pin: '9876' }))).status, 200);
const previous = await service.readPin();
await service.changePin('6543', previous, user.id);
await assert.rejects(service.changePin('1111', previous, user.id));
assert.equal(service.matchesPin('6543', await service.readPin()), true);
const fresh = load('lib/manager-pin-server.ts', { '@supabase/supabase-js': { createClient: () => db } });
assert.equal(fresh.matchesPin('6543', await fresh.readPin()), true);
const request = req({});
for (let i = 0; i < 8; i++) assert.equal(fresh.checkPinRate(request), true);
assert.equal(fresh.checkPinRate(request), false);
fresh.clearPinRate(request);
assert.equal(fresh.checkPinRate(request), true);
console.log('✓ PIN: autenticação, perfil, senha atual, persistência, rejeição do PIN antigo, concorrência e limite de tentativas.');
