const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { withActiveSubscriptionFlag } = require('../services/profiles');

test('withActiveSubscriptionFlag não consulta o banco para quem não é pagante', async () => {
  const basic = await withActiveSubscriptionFlag({ id: 'u1', access_state: { isPaidProAccess: false, accessSource: 'none' } });
  assert.equal(basic.access_state.hasActiveRecurringSubscription, false);

  const trial = await withActiveSubscriptionFlag({ id: 'u2', access_state: { isPaidProAccess: true, accessSource: 'trial' } });
  assert.equal(trial.access_state.hasActiveRecurringSubscription, false);

  const affiliate = await withActiveSubscriptionFlag({ id: 'u3', access_state: { isPaidProAccess: false, accessSource: 'none', isAffiliate: true } });
  assert.equal(affiliate.access_state.hasActiveRecurringSubscription, false);
});

test('withActiveSubscriptionFlag para pagante degrada para false sem Supabase configurado (não lança)', async () => {
  const paid = await withActiveSubscriptionFlag({ id: 'u4', access_state: { isPaidProAccess: true, accessSource: 'paid' } });
  assert.equal(paid.access_state.hasActiveRecurringSubscription, false);
});

test('withActiveSubscriptionFlag repassa perfil nulo/sem access_state sem alterar', async () => {
  assert.equal(await withActiveSubscriptionFlag(null), null);
  assert.deepEqual(await withActiveSubscriptionFlag({ id: 'u5' }), { id: 'u5' });
});
