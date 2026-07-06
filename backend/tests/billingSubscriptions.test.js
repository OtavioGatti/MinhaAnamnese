const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { getActiveBillingSubscriptionByUserId } = require('../services/billingSubscriptions');

test('getActiveBillingSubscriptionByUserId devolve null para user_id inválido sem tentar rede', async () => {
  assert.equal(await getActiveBillingSubscriptionByUserId(''), null);
  assert.equal(await getActiveBillingSubscriptionByUserId(null), null);
  assert.equal(await getActiveBillingSubscriptionByUserId('não-é-um-uuid'), null);
});

test('getActiveBillingSubscriptionByUserId lança quando o Supabase não está configurado', async () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  await assert.rejects(
    () => getActiveBillingSubscriptionByUserId(validUuid),
    /billing subscription storage unavailable/,
  );
});
