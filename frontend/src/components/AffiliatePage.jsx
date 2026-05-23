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

function AffiliatePage({ user, referralCode, onLogin }) {
  const [affiliateData, setAffiliateData] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [desiredCode, setDesiredCode] = useState('');

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
  const affiliateLink = useMemo(() => (affiliate?.code ? buildAffiliateLink(affiliate.code) : ''), [affiliate?.code]);
  const normalizedDesiredCode = normalizeAffiliateCode(desiredCode);
  const previewLink = normalizedDesiredCode ? buildAffiliateLink(normalizedDesiredCode) : '';

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

  return (
    <div className="affiliate-page">
      <section className="workspace-surface affiliate-hero">
        <div>
          <span className="workspace-kicker">Afiliados</span>
          <h1>Indique o Minha Anamnese</h1>
          <p>
            Gere seu link, divulgue para colegas e acompanhe comissões de 30% sobre pagamentos aprovados.
          </p>
        </div>
        <div className="affiliate-hero-rate">
          <strong>30%</strong>
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
                <span>Comissão pendente</span>
                <strong>{formatCurrency(stats?.pendingCommission)}</strong>
              </div>
              <div>
                <span>Total registrado</span>
                <strong>{formatCurrency(stats?.totalCommission)}</strong>
              </div>
              <div>
                <span>Conversões</span>
                <strong>{stats?.conversions || 0}</strong>
              </div>
            </div>
            <p className="affiliate-small-print">
              Comissões entram como pendentes após pagamento aprovado. Saques e baixa manual entram em uma próxima etapa operacional.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default AffiliatePage;
