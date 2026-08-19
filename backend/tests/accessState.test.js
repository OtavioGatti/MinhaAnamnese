const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { resolveUserAccessState } = require('../services/accessState');

describe('resolveUserAccessState', () => {
  test('conta basica sem perfil nao ganha acesso pro', () => {
    const state = resolveUserAccessState({ profile: null });

    assert.equal(state.hasActiveProAccess, false);
    assert.equal(state.effectivePlan, 'basic');
  });

  // Exploit real: user_metadata é gravável pelo próprio usuário via
  // supabase.auth.updateUser({ data: { plan: 'pro' } }). O acesso Pro precisa
  // vir só da coluna profiles.current_plan (gravada pelo backend/webhook),
  // nunca de metadata que o cliente controla.
  test('user_metadata.plan=pro nao concede acesso sem profile pro real (conta recem-criada)', () => {
    const state = resolveUserAccessState({
      profile: {
        current_plan: 'basic',
        billing_status: 'inactive',
        plan_expires_at: null,
      },
    });

    assert.equal(state.hasActiveProAccess, false);
    assert.equal(state.effectivePlan, 'basic');
  });

  test('user_metadata.plan=pro nao concede acesso sem nenhum profile', () => {
    const state = resolveUserAccessState({ profile: undefined });

    assert.equal(state.hasActiveProAccess, false);
  });

  test('profile.current_plan=pro com billing_status active concede acesso', () => {
    const state = resolveUserAccessState({
      profile: { current_plan: 'pro', billing_status: 'active', plan_expires_at: null },
    });

    assert.equal(state.hasActiveProAccess, true);
    assert.equal(state.effectivePlan, 'pro');
  });

  test('profile.current_plan=pro com billing_status expired nao concede acesso', () => {
    const state = resolveUserAccessState({
      profile: { current_plan: 'pro', billing_status: 'expired', plan_expires_at: null },
    });

    assert.equal(state.hasActiveProAccess, false);
    assert.equal(state.isProExpired, true);
  });

  test('affiliate tem acesso pro independente de billing_status', () => {
    const state = resolveUserAccessState({
      profile: { current_plan: 'affiliate', billing_status: 'inactive' },
    });

    assert.equal(state.hasActiveProAccess, true);
    assert.equal(state.isAffiliate, true);
    assert.equal(state.effectivePlan, 'affiliate');
  });

  test('trial ativo com prazo futuro conta como trial, nao como pago', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    const state = resolveUserAccessState({
      profile: {
        current_plan: 'pro',
        billing_status: 'active',
        access_source: 'trial',
        plan_expires_at: future,
      },
    });

    assert.equal(state.hasActiveProAccess, true);
    assert.equal(state.isTrialAccess, true);
    assert.equal(state.isPaidProAccess, false);
  });
});
