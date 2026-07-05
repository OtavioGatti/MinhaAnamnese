import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function buildAffiliateLink(code) {
  const origin = window.location.origin || 'https://www.minhaanamnese.com.br';
  return `${origin}/afiliado?ref=${encodeURIComponent(code)}`;
}

function normalizeAffiliateCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const PAYOUT_STATUS_LABELS = {
  requested: 'Em processamento',
  paid: 'Pago',
  rejected: 'Rejeitado',
};

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

function AffiliatePage({ user, referralCode, onLogin }) {
  const [affiliateData, setAffiliateData] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [desiredCode, setDesiredCode] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAffiliateData(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    api.get('/affiliate')
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (!response.success) {
          throw new Error(response.error || 'Não foi possível carregar o programa de afiliados.');
        }

        setAffiliateData(response.data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || 'Não foi possível carregar o programa de afiliados.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const affiliate = affiliateData?.affiliate || null;
  const stats = affiliateData?.stats || null;
  const payouts = Array.isArray(affiliateData?.payouts) ? affiliateData.payouts : [];
  const payoutMinAmount = Number(affiliateData?.payoutMinAmount) || 50;
  const affiliateLink = useMemo(() => (affiliate?.code ? buildAffiliateLink(affiliate.code) : ''), [affiliate?.code]);
  const normalizedDesiredCode = normalizeAffiliateCode(desiredCode);
  const previewLink = normalizedDesiredCode ? buildAffiliateLink(normalizedDesiredCode) : '';
  const commissionPercent = affiliate
    ? Math.round((Number(affiliate.commission_rate) || 0.3) * 100)
    : 30;
  const availableCommission = Number(stats?.availableCommission) || 0;
  const processingCommission = Number(stats?.processingCommission) || 0;
  const hasOpenPayout = payouts.some((payout) => payout.status === 'requested');
  const belowMinimum = availableCommission < payoutMinAmount;
  const canRequestPayout = Boolean(affiliate) && !hasOpenPayout && !belowMinimum;

  const handleCreateAffiliate = async () => {
    if (!normalizedDesiredCode || normalizedDesiredCode.length < 3) {
      setError('Escolha um código com pelo menos 3 caracteres.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await api.post('/affiliate', {
        code: normalizedDesiredCode,
      });

      if (!response.success) {
        throw new Error(response.error || 'Não foi possível gerar seu link.');
      }

      setAffiliateData(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível gerar seu link.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!affiliateLink) {
      return;
    }

    await navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleRequestPayout = async () => {
    const normalizedPixKey = pixKey.trim();

    if (!normalizedPixKey) {
      setPayoutError('Informe sua chave PIX para receber o saque.');
      return;
    }

    setRequestingPayout(true);
    setPayoutError('');
    setPayoutSuccess('');

    try {
      const response = await api.post('/affiliate/payouts', {
        pixKey: normalizedPixKey,
      });

      if (!response.success) {
        throw new Error(response.error || 'Não foi possível solicitar o saque.');
      }

      setAffiliateData((current) => ({
        ...(current || {}),
        stats: response.data?.stats || current?.stats || null,
        payouts: Array.isArray(response.data?.payouts) ? response.data.payouts : [],
        payoutMinAmount: response.data?.payoutMinAmount || current?.payoutMinAmount,
      }));
      setPayoutSuccess('Saque solicitado! A transferência via PIX será feita manualmente e o status atualizado aqui.');
      setPixKey('');
    } catch (requestError) {
      setPayoutError(requestError.message || 'Não foi possível solicitar o saque.');
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div className="affiliate-page">
      <section className="workspace-surface affiliate-hero">
        <div>
          <span className="workspace-kicker">Afiliados</span>
          <h1>Indique o Minha Anamnese</h1>
          <p>
            Gere seu link, divulgue para colegas e acompanhe comissões de {commissionPercent}% sobre pagamentos aprovados.
          </p>
        </div>
        <div className="affiliate-hero-rate">
          <strong>{commissionPercent}%</strong>
          <span>por venda aprovada</span>
        </div>
      </section>

      {referralCode ? (
        <section className="affiliate-referral-note">
          <strong>Indicação registrada</strong>
          <span>Se você assinar agora, a indicação de código {referralCode} será considerada no checkout.</span>
        </section>
      ) : null}

      {!user ? (
        <section className="affiliate-card affiliate-empty">
          <h2>Entre para gerar seu link</h2>
          <p>O link é vinculado à sua conta para que cada pagamento aprovado seja contabilizado com segurança.</p>
          <button type="button" className="btn btn-primario" onClick={onLogin}>
            Entrar ou criar conta
          </button>
        </section>
      ) : (
        <div className="affiliate-grid">
          <section className="affiliate-card">
            <h2>Seu link</h2>
            <p>Compartilhe este endereço. Quando alguém assinar por ele, a comissão será registrada automaticamente.</p>

            {loading ? (
              <div className="affiliate-loading">Carregando...</div>
            ) : affiliate ? (
              <>
                <div className="affiliate-link-box">
                  <span>{affiliateLink}</span>
                  <button type="button" className="btn btn-secundario" onClick={handleCopy}>
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="affiliate-code-row">
                  <span>Código</span>
                  <strong>{affiliate.code}</strong>
                </div>
              </>
            ) : (
              <div className="affiliate-code-form">
                <label htmlFor="affiliate-code">Escolha seu código</label>
                <div className="affiliate-code-input-row">
                  <span>ref=</span>
                  <input
                    id="affiliate-code"
                    type="text"
                    value={desiredCode}
                    onChange={(event) => {
                      setDesiredCode(event.target.value);
                      setError('');
                    }}
                    placeholder="seu-nome"
                    maxLength={48}
                  />
                </div>
                {previewLink ? (
                  <div className="affiliate-link-preview">
                    <span>Prévia</span>
                    <strong>{previewLink}</strong>
                  </div>
                ) : null}
                <button type="button" className="btn btn-primario" onClick={handleCreateAffiliate} disabled={creating}>
                  {creating ? 'Gerando...' : 'Gerar meu link'}
                </button>
              </div>
            )}

            {error ? <div className="templates-inline-error">{error}</div> : null}
          </section>

          <section className="affiliate-card">
            <h2>Resumo</h2>
            <div className="affiliate-stats">
              <div>
                <span>Disponível para saque</span>
                <strong>{formatCurrency(availableCommission)}</strong>
              </div>
              <div>
                <span>Em processamento</span>
                <strong>{formatCurrency(processingCommission)}</strong>
              </div>
              <div>
                <span>Total pago</span>
                <strong>{formatCurrency(stats?.paidCommission)}</strong>
              </div>
              <div>
                <span>Conversões</span>
                <strong>{stats?.conversions || 0}</strong>
              </div>
            </div>
            <p className="affiliate-small-print">
              Comissões entram como disponíveis após pagamento aprovado. Ao solicitar um saque, o valor fica em
              processamento até a transferência via PIX ser confirmada.
            </p>
          </section>

          {affiliate ? (
            <section className="affiliate-card affiliate-payout-card">
              <h2>Saque</h2>
              <p>
                Saque mínimo de {formatCurrency(payoutMinAmount)}. A transferência é feita manualmente via PIX e o
                status fica registrado aqui para acompanhamento.
              </p>

              {hasOpenPayout ? (
                <div className="affiliate-payout-open">
                  Você tem um saque em processamento. Aguarde a transferência para solicitar outro.
                </div>
              ) : (
                <div className="affiliate-payout-form">
                  <label htmlFor="affiliate-pix-key">Chave PIX</label>
                  <div className="affiliate-payout-input-row">
                    <input
                      id="affiliate-pix-key"
                      type="text"
                      value={pixKey}
                      onChange={(event) => {
                        setPixKey(event.target.value);
                        setPayoutError('');
                      }}
                      placeholder="CPF, e-mail, telefone ou chave aleatória"
                      maxLength={140}
                    />
                    <button
                      type="button"
                      className="btn btn-primario"
                      onClick={handleRequestPayout}
                      disabled={!canRequestPayout || requestingPayout}
                    >
                      {requestingPayout ? 'Solicitando...' : 'Solicitar saque'}
                    </button>
                  </div>
                  {belowMinimum ? (
                    <span className="affiliate-payout-hint">
                      Saldo disponível de {formatCurrency(availableCommission)} — o saque libera a partir de {formatCurrency(payoutMinAmount)}.
                    </span>
                  ) : null}
                </div>
              )}

              {payoutError ? <div className="templates-inline-error">{payoutError}</div> : null}
              {payoutSuccess ? <div className="affiliate-payout-success">{payoutSuccess}</div> : null}

              {payouts.length > 0 ? (
                <div className="affiliate-payout-history">
                  <h3>Histórico de saques</h3>
                  <ul>
                    {payouts.map((payout) => (
                      <li key={payout.id}>
                        <div>
                          <strong>{formatCurrency(payout.amount)}</strong>
                          <span>
                            Solicitado em {formatDate(payout.requested_at)}
                            {payout.status === 'paid' && payout.paid_at ? ` · pago em ${formatDate(payout.paid_at)}` : ''}
                          </span>
                        </div>
                        <span className={`affiliate-payout-status affiliate-payout-status-${payout.status}`}>
                          {PAYOUT_STATUS_LABELS[payout.status] || payout.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default AffiliatePage;
