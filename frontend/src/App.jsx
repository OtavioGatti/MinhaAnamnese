import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './apiClient';
import CalculatorPanel from './components/CalculatorPanel';
import GuidePanel from './components/GuidePanel';
import { supabase } from './lib/supabaseClient';
import { evaluateAnamnesisQuality } from './utils/anamnesisQualityScore';

const TEMPLATE_WITH_CALCULATORS = 'obstetricia';
const INSIGHTS_PREVIEW_LINES = 4;
const CHECKOUT_RETURN_STATE_KEY = 'checkout-return-state';
const CHECKOUT_API_BASE_URL =
  import.meta.env.VITE_CHECKOUT_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'https://minha-anamnese.vercel.app'
    : window.location.origin);

function getInsightsLines(content) {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, allLines) => line || (index > 0 && allLines[index - 1]));
}

function getInsightsPreview(content) {
  return getInsightsLines(content).slice(0, INSIGHTS_PREVIEW_LINES).join('\n');
}

function getHiddenInsightsCount(content) {
  if (!content) {
    return 0;
  }

  return Math.max(getInsightsLines(content).length - INSIGHTS_PREVIEW_LINES, 0);
}

function saveCheckoutReturnState(state) {
  sessionStorage.setItem(CHECKOUT_RETURN_STATE_KEY, JSON.stringify(state));
}

function getCheckoutReturnState() {
  const rawState = sessionStorage.getItem(CHECKOUT_RETURN_STATE_KEY);

  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(rawState);
  } catch {
    sessionStorage.removeItem(CHECKOUT_RETURN_STATE_KEY);
    return null;
  }
}

function clearCheckoutReturnState() {
  sessionStorage.removeItem(CHECKOUT_RETURN_STATE_KEY);
}

function getUserDisplayName(user) {
  const email = user?.email || '';

  if (!email.includes('@')) {
    return 'Olá';
  }

  const [rawName] = email.split('@');
  const normalizedName = rawName
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return normalizedName || 'Olá';
}

function App() {
  const emailInputRef = useRef(null);
  const otpInputRef = useRef(null);
  const autoSubmitTriggeredRef = useRef(false);
  const [templates, setTemplates] = useState([]);
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [user, setUser] = useState(null);
  const [insights, setInsights] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [erro, setErro] = useState('');
  const [authError, setAuthError] = useState('');
  const [authFeedback, setAuthFeedback] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [tooltipGuia, setTooltipGuia] = useState(false);
  const [jaSelecionou, setJaSelecionou] = useState(false);

  const templateTemCalculadora = templateSelecionado === TEMPLATE_WITH_CALCULATORS;
  const userPlan = user?.user_metadata?.plan || 'basic';
  const isPro = userPlan === 'pro';
  const otpIsComplete = otpCode.trim().length >= 6;

  useEffect(() => {
    if (cooldownTimer <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldownTimer((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownTimer]);

  useEffect(() => {
    if (user) {
      return;
    }

    if (step === 'otp') {
      otpInputRef.current?.focus();
      otpInputRef.current?.select();
      return;
    }

    emailInputRef.current?.focus();
  }, [step, user]);

  useEffect(() => {
    if (step !== 'otp') {
      autoSubmitTriggeredRef.current = true;
      return;
    }

    if (!otpIsComplete || loadingAuth || autoSubmitTriggeredRef.current) {
      return;
    }

    autoSubmitTriggeredRef.current = true;
    handleConfirmarCodigo();
  }, [otpCode, step, loadingAuth]);

  useEffect(() => {
    async function carregarSessao() {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setErro('Não foi possível carregar sua sessão.');
      }

      setUser(data.session?.user || null);
      setLoadingUser(false);
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoadingUser(false);

      if (session?.user) {
        setEmail('');
        setOtpCode('');
        setStep('email');
        setAuthError('');
        setAuthFeedback('');
        setCooldownTimer(0);
        autoSubmitTriggeredRef.current = false;
      }
    });

    carregarSessao();

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function atualizarSessaoAposCheckout() {
      const checkoutStatus = new URLSearchParams(window.location.search).get('checkout');

      if (checkoutStatus !== 'success') {
        return;
      }

      const returnState = getCheckoutReturnState();

      if (returnState) {
        setTemplateSelecionado(returnState.templateSelecionado || '');
        setTexto(returnState.texto || '');
        setResultado(returnState.resultado || '');
        setInsights(returnState.insights || '');
        setGuiaAberto(Boolean(returnState.guiaAberto));
        setCalculadoraAberta(Boolean(returnState.calculadoraAberta));
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data, error } = await supabase.auth.refreshSession();

        if (!error) {
          setUser(data.session?.user || session.user || null);
        }
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('checkout');
      window.history.replaceState({}, '', nextUrl.toString());
      clearCheckoutReturnState();
    }

    atualizarSessaoAposCheckout();
  }, []);

  useEffect(() => {
    async function carregarTemplates() {
      setLoadingTemplates(true);
      const response = await api.get('/templates');

      if (response.success) {
        setTemplates(response.data);
      } else {
        setErro(response.error || 'Não foi possível carregar os modelos clínicos.');
      }

      setLoadingTemplates(false);
    }

    carregarTemplates();
  }, []);

  useEffect(() => {
    if (!templateTemCalculadora) {
      setCalculadoraAberta(false);
    }
  }, [templateTemCalculadora]);

  const handleTemplateChange = (e) => {
    const novoTemplate = e.target.value;
    setTemplateSelecionado(novoTemplate);

    if (novoTemplate === TEMPLATE_WITH_CALCULATORS) {
      setCalculadoraAberta(true);
    }

    if (novoTemplate && !jaSelecionou) {
      setTooltipGuia(true);
      setJaSelecionou(true);
      setTimeout(() => setTooltipGuia(false), 5000);
    }
  };

  const handleOrganizar = async () => {
    setErro('');
    setResultado('');

    if (!templateSelecionado) {
      setErro('Selecione um modelo clínico para continuar.');
      return;
    }

    if (!texto.trim()) {
      setErro('Preencha a anamnese antes de continuar.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/organizar', {
        template: templateSelecionado,
        texto,
      });

      if (response.success) {
        setResultado(response.data.resultado);
      } else {
        setErro(response.error || 'Não foi possível estruturar a anamnese.');
      }
    } catch (err) {
      setErro(err.message || 'Ocorreu um erro ao estruturar a anamnese.');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setTemplateSelecionado('');
    setTexto('');
    setResultado('');
    setInsights('');
    setErro('');
    setCalculadoraAberta(false);
  };

  const handleCopiar = async () => {
    if (!resultado) return;

    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = resultado;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleGerarInsights = async () => {
    if (!resultado.trim() || !templateSelecionado) {
      setErro('Gere a anamnese estruturada antes de avaliar sua qualidade.');
      return;
    }

    setErro('');
    setLoadingInsights(true);

    try {
      const response = await api.post('/insights', {
        texto: resultado,
        templateId: templateSelecionado,
        userId: user?.id || null,
      });

      if (response.success) {
        setInsights(response.data);
      } else {
        setErro(response.error || 'Não foi possível avaliar a qualidade da anamnese.');
      }
    } catch (_err) {
      setErro('Não foi possível avaliar a qualidade da anamnese.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleUpgradeInsights = () => {
    if (!user?.id || !user?.email) {
      setErro('Acesse sua conta para liberar o plano profissional.');
      return;
    }

    setErro('');
    setLoadingCheckout(true);
    saveCheckoutReturnState({
      templateSelecionado,
      texto,
      resultado,
      insights,
      guiaAberto,
      calculadoraAberta,
    });

    fetch(`${CHECKOUT_API_BASE_URL}/api/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
      }),
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        const json = contentType.includes('application/json')
          ? await response.json()
          : null;

        if (!response.ok || !json?.success || !json?.data?.init_point) {
          throw new Error(json?.error || 'Não foi possível iniciar o pagamento');
        }

        window.location.href = json.data.init_point;
      })
      .catch((error) => {
        setErro(error.message || 'Não foi possível iniciar o pagamento');
        setLoadingCheckout(false);
      });
  };

  const handleEnviarCodigo = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setAuthError('Informe um e-mail válido.');
      return;
    }

    if (loadingAuth || cooldownTimer > 0) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setAuthError('Não foi possível enviar o código para o e-mail informado.');
      setLoadingAuth(false);
      return;
    }

    setEmail(normalizedEmail);
    setOtpCode('');
    setStep('otp');
    setCooldownTimer(60);
    autoSubmitTriggeredRef.current = false;
    setAuthFeedback('Código enviado para seu e-mail');
    setLoadingAuth(false);
    return;
  };

  const handleConfirmarCodigo = async () => {
    if (!email.trim() || !otpCode.trim() || loadingAuth) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otpCode.trim(),
      type: 'email',
    });

    if (error) {
      setAuthError('Código inválido ou expirado');
      setLoadingAuth(false);
      autoSubmitTriggeredRef.current = true;
      return;
    }

    setEmail('');
    setOtpCode('');
    setStep('email');
    setAuthError('');
    setAuthFeedback('');
    setCooldownTimer(0);
    setLoadingAuth(false);
    autoSubmitTriggeredRef.current = false;
  };

  const handleVoltarEtapaEmail = () => {
    if (loadingAuth) {
      return;
    }

    setOtpCode('');
    setStep('email');
    setAuthError('');
    setAuthFeedback('');
    autoSubmitTriggeredRef.current = false;
  };

  const handleReenviarCodigo = async () => {
    if (loadingAuth || cooldownTimer > 0) {
      return;
    }

    await handleEnviarCodigo();
  };

  const handleSair = async () => {
    setLoadingUser(true);
    await supabase.auth.signOut();
    setEmail('');
    setOtpCode('');
    setStep('email');
    setAuthError('');
    setAuthFeedback('');
    setCooldownTimer(0);
    autoSubmitTriggeredRef.current = false;
    setLoadingUser(false);
  };

  const insightsPreview = insights ? getInsightsPreview(insights) : '';
  const shouldShowPaywall = insights && !isPro;
  const hiddenInsightsCount = getHiddenInsightsCount(insights);
  const userDisplayName = user ? getUserDisplayName(user) : '';
  const qualityScore = useMemo(() => evaluateAnamnesisQuality(resultado), [resultado]);

  return (
    <div className="container">
      <header className="header">
        <div className="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </div>
        <h1>Minha Anamnese</h1>
        <p>Padronize e eleve a qualidade das suas anamneses clínicas</p>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
          {loadingUser ? (
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Carregando acesso...</span>
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.4 }}>
                <span style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 500 }}>
                  Olá, {userDisplayName}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  {user.email} · Acesso {isPro ? 'profissional' : 'básico'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={handleSair}
                style={{ padding: '0.55rem 1rem' }}
              >
                Sair
              </button>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '360px',
                marginInline: 'auto',
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.05)',
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  if (step === 'email') {
                    handleEnviarCodigo();
                    return;
                  }

                  handleConfirmarCodigo();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    minHeight: '3.75rem',
                    opacity: 1,
                    transform: 'translateY(0)',
                    transition: 'opacity 180ms ease, transform 180ms ease',
                  }}
                >
                  <strong style={{ fontSize: '1rem', color: '#111827' }}>
                    {step === 'email' ? 'Acesse sua conta' : 'Digite o código'}
                  </strong>
                  <span style={{ fontSize: '0.88rem', color: '#6b7280' }}>
                    {step === 'email'
                      ? 'Receba um código e continue rapidamente'
                      : 'Enviamos um código para seu e-mail'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    opacity: 1,
                    transform: 'translateY(0)',
                    transition: 'opacity 180ms ease, transform 180ms ease',
                  }}
                >
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (authError) {
                        setAuthError('');
                      }
                    }}
                    placeholder="Seu e-mail"
                    disabled={loadingAuth || step === 'otp'}
                    style={{
                      width: '100%',
                      padding: '0.8rem 0.9rem',
                      border: '1px solid #d7deea',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: loadingAuth || step === 'otp' ? '#f8fafc' : '#ffffff',
                    }}
                  />

                  {step === 'otp' && (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <input
                        ref={otpInputRef}
                        type="text"
                        inputMode="text"
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(e) => {
                          autoSubmitTriggeredRef.current = false;
                          setOtpCode(e.target.value.trim());
                          if (authError) {
                            setAuthError('');
                          }
                        }}
                        onPaste={(e) => {
                          autoSubmitTriggeredRef.current = false;
                          const pastedCode = e.clipboardData.getData('text').trim();
                          if (pastedCode) {
                            e.preventDefault();
                            setOtpCode(pastedCode);
                            if (authError) {
                              setAuthError('');
                            }
                          }
                        }}
                        placeholder="Digite o código"
                        disabled={loadingAuth}
                      style={{
                          width: '100%',
                          padding: '0.85rem 1rem',
                          border: '1px solid #d7deea',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          letterSpacing: '0.14rem',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
                        }}
                      />
                      <div
                        aria-hidden="true"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                          gap: '0.35rem',
                        }}
                      >
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            style={{
                              height: '0.28rem',
                              borderRadius: '999px',
                              backgroundColor: otpCode[index] ? '#2563eb' : '#d7deea',
                              transition: 'background-color 160ms ease',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {authFeedback && (
                  <span style={{ fontSize: '0.82rem', color: '#4b5563' }}>
                    {authFeedback}
                  </span>
                )}

                {authError && (
                  <div
                    style={{
                      padding: '0.75rem 0.9rem',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.84rem',
                      lineHeight: 1.45,
                    }}
                  >
                    {authError}
                  </div>
                )}

                {step === 'email' ? (
                  <button
                    type="submit"
                    className="btn btn-secundario"
                    disabled={loadingAuth || cooldownTimer > 0}
                    style={{ padding: '0.65rem 1rem' }}
                  >
                    {loadingAuth
                      ? 'Enviando código...'
                      : cooldownTimer > 0
                        ? `Reenviar código em ${cooldownTimer}s`
                        : 'Enviar código'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      className="btn btn-secundario"
                      disabled={loadingAuth || !otpCode.trim()}
                      style={{ padding: '0.65rem 1rem' }}
                    >
                      {loadingAuth ? 'Confirmando acesso...' : 'Confirmar acesso'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={handleReenviarCodigo}
                      disabled={loadingAuth || cooldownTimer > 0}
                      style={{ padding: '0.65rem 1rem' }}
                    >
                      {cooldownTimer > 0
                        ? `Reenviar código em ${cooldownTimer}s`
                        : 'Reenviar código'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={handleVoltarEtapaEmail}
                      disabled={loadingAuth}
                      style={{ padding: '0.65rem 1rem' }}
                    >
                      Alterar e-mail
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </header>

      <div className="aviso">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Utilize apenas informações clínicas não identificáveis, conforme boas práticas de confidencialidade.</span>
      </div>

      <div className="layout-principal">
        <GuidePanel templateSelecionado={templateSelecionado} aberto={guiaAberto} />

        <div className="conteudo-principal">
          <div className="card">
            <div className="card-header">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <h2>Dados da consulta</h2>
            </div>

            <div className="form-group">
              <label htmlFor="template">Modelo clínico</label>
              <div className="input-wrapper">
                <select
                  id="template"
                  value={templateSelecionado}
                  onChange={handleTemplateChange}
                  disabled={loadingTemplates}
                >
                  <option value="">
                    {loadingTemplates ? 'Carregando modelos...' : 'Selecione um modelo clínico...'}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="texto">Anotações clínicas</label>
              <div className="input-wrapper">
                <textarea
                  id="texto"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Digite ou cole aqui as anotações clínicas da consulta..."
                />
                {texto.length > 0 && (
                  <span className="char-count">{texto.length} caracteres</span>
                )}
              </div>

              {tooltipGuia && (
                <div className="tooltip-guia">
                  <div className="tooltip-content">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>
                      Use <strong>"Mostrar guia"</strong> para consultar os itens essenciais da coleta clínica.
                    </span>
                  </div>
                  <button
                    className="tooltip-fechar"
                    onClick={() => setTooltipGuia(false)}
                    aria-label="Fechar orientação"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="painel-acoes">
                <button
                  className="btn-guia-toggle"
                  onClick={() => setGuiaAberto(!guiaAberto)}
                  title="Mostrar ou ocultar guia clínico"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  {guiaAberto ? 'Ocultar guia clínico' : 'Mostrar guia clínico'}
                </button>

                {templateTemCalculadora && (
                  <button
                    className="btn-guia-toggle"
                    onClick={() => setCalculadoraAberta(!calculadoraAberta)}
                    title="Mostrar ou ocultar cálculos clínicos"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2"/>
                      <line x1="8" y1="6" x2="16" y2="6"/>
                      <line x1="8" y1="10" x2="8" y2="10"/>
                      <line x1="12" y1="10" x2="12" y2="10"/>
                      <line x1="16" y1="10" x2="16" y2="10"/>
                      <line x1="8" y1="14" x2="8" y2="14"/>
                      <line x1="12" y1="14" x2="12" y2="14"/>
                      <line x1="16" y1="14" x2="16" y2="14"/>
                      <line x1="8" y1="18" x2="16" y2="18"/>
                    </svg>
                    {calculadoraAberta ? 'Ocultar cálculos clínicos' : 'Mostrar cálculos clínicos'}
                  </button>
                )}
              </div>
            </div>

            <div className="botoes">
              <button
                className="btn btn-primario"
                onClick={handleOrganizar}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Estruturando anamnese...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4"/>
                      <path d="m16.2 7.8 2.9-2.9"/>
                      <path d="M18 12h4"/>
                      <path d="m16.2 16.2 2.9 2.9"/>
                      <path d="M12 18v4"/>
                      <path d="m4.9 19.1 2.9-2.9"/>
                      <path d="M2 12h4"/>
                      <path d="m4.9 4.9 2.9 2.9"/>
                    </svg>
                    Gerar anamnese estruturada
                  </>
                )}
              </button>
              <button
                className="btn btn-secundario"
                onClick={handleLimpar}
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Limpar campos
              </button>
            </div>

            {erro && (
              <div className="erro">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{erro}</span>
                <button
                  className="btn-erro-dismiss"
                  onClick={() => setErro('')}
                  title="Fechar"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {resultado && (
            <>
              <div className="card">
                <div className="card-header">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <h2>Anamnese estruturada</h2>
                </div>

                <div className="resultado-container">
                  <div className="resultado">{resultado}</div>
                  <button
                    className={`btn btn-copiar ${copiado ? 'copiado' : ''}`}
                    onClick={handleCopiar}
                  >
                    {copiado ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Texto copiado
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                        Copiar anamnese
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secundario"
                    onClick={handleGerarInsights}
                    disabled={loadingInsights}
                  >
                    {loadingInsights ? 'Avaliando qualidade da anamnese...' : 'Avaliar qualidade da anamnese'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18"/>
                    <path d="M7 8h10"/>
                    <path d="M7 16h6"/>
                  </svg>
                  <h2>Qualidade da anamnese</h2>
                </div>

                <div style={{ display: 'grid', gap: '0.9rem' }}>
                  {qualityScore.shouldShowScore ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                            {qualityScore.score}%
                          </div>
                          <div style={{ marginTop: '0.3rem', fontSize: '0.92rem', color: '#4b5563' }}>
                            {qualityScore.message}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: '0.55rem',
                          borderRadius: '999px',
                          backgroundColor: '#e5e7eb',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${qualityScore.score}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: qualityScore.score >= 75
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : qualityScore.score >= 55
                                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                : 'linear-gradient(90deg, #f97316, #ef4444)',
                            transition: 'width 500ms ease',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          padding: '0.85rem 0.95rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#f9fafb',
                          color: '#4b5563',
                          fontSize: '0.88rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {qualityScore.justification}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        padding: '0.95rem 1rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        backgroundColor: '#f9fafb',
                        color: '#4b5563',
                        fontSize: '0.9rem',
                        lineHeight: 1.55,
                      }}
                    >
                      <strong style={{ display: 'block', color: '#1f2937', marginBottom: '0.2rem' }}>
                        Estimativa ainda indisponível
                      </strong>
                      <span>{qualityScore.message}</span>
                      <div style={{ marginTop: '0.35rem' }}>{qualityScore.justification}</div>
                    </div>
                  )}

                  {!isPro && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <button
                        className="btn btn-secundario"
                        type="button"
                        onClick={handleGerarInsights}
                        disabled={loadingInsights}
                      >
                        {loadingInsights ? 'Avaliando qualidade da anamnese...' : 'Ver avaliação completa'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {insights && (
            <div className="card">
              <div className="card-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a9 9 0 1 0 9 9"/>
                  <path d="M12 7v5l3 3"/>
                </svg>
                <h2>Avaliação clínica da anamnese</h2>
              </div>

              <div className="resultado-container">
                <div className="resultado">{isPro ? insights : insightsPreview}</div>

                {shouldShowPaywall && (
                  <div className="erro" style={{ marginTop: '1rem', animation: 'none' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2"/>
                      <line x1="12" y1="11" x2="12" y2="17"/>
                      <circle cx="12" cy="8" r="1"/>
                    </svg>
                    <div style={{ flex: 1 }}>
                      <span>
                        {'\u{1F512}'} Desbloqueie a avaliação completa para ampliar a qualidade da anamnese
                        {hiddenInsightsCount > 0 ? ` (${hiddenInsightsCount} ponto${hiddenInsightsCount > 1 ? 's' : ''} adicional${hiddenInsightsCount > 1 ? 's' : ''} disponível${hiddenInsightsCount > 1 ? 'is' : ''})` : ''}
                      </span>
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-secundario"
                          type="button"
                          onClick={handleUpgradeInsights}
                          disabled={loadingCheckout}
                        >
                          {loadingCheckout ? 'Redirecionando para o pagamento...' : 'Fazer upgrade para o plano profissional'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {templateTemCalculadora && calculadoraAberta && <CalculatorPanel />}
      </div>

      <footer className="footer">
        <p>Minha Anamnese &middot; Apoio à padronização clínica &middot; Nenhum dado é armazenado</p>
      </footer>
    </div>
  );
}

export default App;
