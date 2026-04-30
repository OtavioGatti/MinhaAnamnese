import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './apiClient';
import { API_BASE_URL } from './config';
import DetailedAnalysis from './components/DetailedAnalysis';
import EvolutionPage from './components/EvolutionPage';
import FreeInsightConfirmModal from './components/FreeInsightConfirmModal';
import InputSection from './components/InputSection';
import InsightBlock from './components/InsightBlock';
import PlanComparisonModal from './components/PlanComparisonModal';
import ProfilePage from './components/ProfilePage';
import StructuralFeedback from './components/StructuralFeedback';
import StructuredOutput from './components/StructuredOutput';
import TemplatesPage from './components/TemplatesPage';
import UserEvolution from './components/UserEvolution';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import CheckoutSuccessBanner from './components/CheckoutSuccessBanner';
import { guides } from './data/guides';
import { supabase } from './lib/supabaseClient';

const TEMPLATE_WITH_CALCULATORS = 'obstetricia';
const CHECKOUT_RETURN_STATE_KEY = 'checkout-return-state';
const TRACKING_SESSION_ID_KEY = 'tracking-session-id';
const DEBUG_MODE = false;
const PRO_PLAN_PRICE_COPY = 'R$ 9,90';
const PRO_PLAN_PERIOD_COPY = '30 dias';
const DEFAULT_TEXT_PLACEHOLDER =
  'Ex: Paciente feminina, 32 anos, com dor abdominal há 2 dias, associada a náuseas, sem vômitos...';
const TEMPLATE_TEXT_PLACEHOLDERS = {
  psiquiatria:
    'Ex: Paciente 37 anos, refere ansiedade diária há meses, insônia inicial, irritabilidade e prejuízo no trabalho...',
  pediatria:
    'Ex: Criança 4 anos, acompanhada pela mãe, com febre e tosse há 2 dias, redução do apetite e vacinação em dia...',
  clinica_medica:
    'Ex: Paciente feminina, 32 anos, com dor abdominal há 2 dias, associada a náuseas, sem vômitos...',
  obstetricia:
    'Ex: Gestante 30 anos, G2P1, 31 semanas pela DUM, refere contrações esporádicas e movimentos fetais presentes...',
  upa_emergencia:
    'Ex: Paciente masculino, 63 anos, dor torácica há 1 hora, sudorese, náusea, PA 170/100 e FC 102...',
  puerperio:
    'Ex: Puérpera 29 anos, 12 dias pós-cesárea, dor mamária esquerda há 2 dias, febre baixa e dificuldade na pega...',
  ginecologia:
    'Ex: Paciente 28 anos, corrimento vaginal há 1 semana, odor forte, dor pélvica leve, DUM há 40 dias...',
  triagem:
    'Ex: Paciente 36 anos, cefaleia intensa iniciada hoje, vômitos, fotofobia, PA 140/90 e relato de pior dor da vida...',
};

function formatBaseExamplePlaceholder(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  return /^ex[:\s]/i.test(text) ? text : `Ex: ${text}`;
}

function normalizeContextualTab(value) {
  return value === 'calculator' ? 'calculator' : 'guide';
}

function isAbsentDisplayValue(value) {
  if (value == null) {
    return true;
  }

  const normalizedValue = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return (
    normalizedValue === '' ||
    normalizedValue === 'nao informado' ||
    normalizedValue === 'nao informado.' ||
    normalizedValue === 'nao refere' ||
    normalizedValue === 'nao refere.'
  );
}

function sanitizeAnamnesisForDisplay(content) {
  if (!content) {
    return '';
  }

  return content.trim();
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

function createTrackingSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateTrackingSessionId() {
  const existingSessionId = sessionStorage.getItem(TRACKING_SESSION_ID_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createTrackingSessionId();
  sessionStorage.setItem(TRACKING_SESSION_ID_KEY, nextSessionId);
  return nextSessionId;
}

function resetTrackingSessionId() {
  const nextSessionId = createTrackingSessionId();
  sessionStorage.setItem(TRACKING_SESSION_ID_KEY, nextSessionId);
  return nextSessionId;
}

function formatRelativeTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);

  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  }

  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(diffMs / 86400000);
  return rtf.format(days, 'day');
}

function isValidScoreValue(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

function createEmptyQualityScore() {
  return {
    shouldShowScore: false,
    score: null,
    message: '',
    justification: '',
    criticalInsight: '',
    otherGaps: [],
  };
}

function normalizeQualityScorePayload(payload) {
  const score = isValidScoreValue(payload?.score) ? payload.score : null;

  return {
    shouldShowScore: isValidScoreValue(score),
    score,
    message: payload?.interpretation?.message || '',
    justification: payload?.interpretation?.justification || '',
    criticalInsight: payload?.interpretation?.criticalInsight || '',
    otherGaps: Array.isArray(payload?.interpretation?.otherGaps) ? payload.interpretation.otherGaps : [],
  };
}

function normalizeBillingStatus(value) {
  return ['inactive', 'active', 'expired'].includes(value) ? value : 'inactive';
}

function normalizePlan(value) {
  return value === 'pro' ? 'pro' : 'basic';
}

function normalizePlanExpiresAt(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function deriveAccessState(user, profile) {
  const currentPlan = normalizePlan(profile?.current_plan);
  const billingStatus = normalizeBillingStatus(profile?.billing_status);
  const planExpiresAt = normalizePlanExpiresAt(profile?.plan_expires_at);
  const expiredByDate = planExpiresAt ? new Date(planExpiresAt).getTime() <= Date.now() : false;
  const hasLegacyMetadataAccess =
    normalizePlan(user?.user_metadata?.plan) === 'pro' &&
    billingStatus === 'inactive' &&
    !planExpiresAt;
  const hasActiveProAccess =
    (currentPlan === 'pro' && billingStatus === 'active' && !expiredByDate) || hasLegacyMetadataAccess;
  const hasLoadedProfile = Boolean(profile?.id);
  const freeFullInsightsUsedCount = Math.max(0, Number(profile?.free_full_insights_used_count) || 0);
  const freeFullInsightsRemaining = user && hasLoadedProfile && !hasActiveProAccess
    ? Math.max(0, 1 - freeFullInsightsUsedCount)
    : 0;

  return {
    effectivePlan: hasActiveProAccess ? 'pro' : 'basic',
    hasActiveProAccess,
    hasFreeFullInsightAvailable: Boolean(user) && hasLoadedProfile && freeFullInsightsRemaining > 0,
    freeFullInsightsRemaining,
    freeFullInsightsUsedCount,
    billingStatus: currentPlan === 'pro' && (billingStatus === 'expired' || expiredByDate) ? 'expired' : billingStatus,
    planExpiresAt,
    isProExpired: currentPlan === 'pro' && (billingStatus === 'expired' || expiredByDate),
  };
}

function getPaywallUiConfig(user, accessState) {
  if (!user) {
    return {
      title: 'Entre para liberar a análise completa',
      description:
        'Seu resultado estruturado já está pronto. Faça login para ver onde a anamnese perdeu força e qual ajuste mais melhora a próxima coleta.',
      buttonLabel: 'Entrar para continuar',
      highlights: ['Leitura completa da anamnese', 'Principal lacuna do caso', 'Próximo passo mais útil'],
    };
  }

  if (accessState?.hasActiveProAccess) {
    return {
      title: 'Análise completa liberada',
      description: 'Veja a leitura detalhada do caso e use o feedback para melhorar sua próxima coleta.',
      buttonLabel: 'Ver análise completa',
      highlights: ['Justificativa da nota', 'Ponto crítico do caso', 'Próximo passo clínico'],
    };
  }

  if (accessState?.hasFreeFullInsightAvailable) {
    return {
      title: 'Você ganhou 1 análise completa grátis',
      description:
        `Use agora para ver como o sistema identifica lacunas, impacto na leitura clínica e o próximo passo mais útil. Depois, continue por ${PRO_PLAN_PRICE_COPY} a cada ${PRO_PLAN_PERIOD_COPY}.`,
      buttonLabel: 'Usar minha análise grátis',
      highlights: ['Justificativa da nota', 'Principal lacuna do caso', `Plano profissional por ${PRO_PLAN_PRICE_COPY}`],
    };
  }

  if (accessState?.billingStatus === 'expired') {
    return {
      title: 'Seu acesso profissional expirou',
      description:
        `A organização continua liberada. Reative por ${PRO_PLAN_PRICE_COPY} para recuperar a análise completa por ${PRO_PLAN_PERIOD_COPY}.`,
      buttonLabel: `Reativar por ${PRO_PLAN_PRICE_COPY}`,
      highlights: ['Análise completa dos casos', 'Próximo passo clínico', `Acesso por ${PRO_PLAN_PERIOD_COPY}`],
    };
  }

  return {
    title: 'Desbloqueie a análise completa',
    description:
      `Sua anamnese já está organizada. Por ${PRO_PLAN_PRICE_COPY}, veja a principal lacuna, o impacto na leitura clínica e o próximo passo para evoluir sua coleta nos próximos ${PRO_PLAN_PERIOD_COPY}.`,
    buttonLabel: `Desbloquear por ${PRO_PLAN_PRICE_COPY}`,
    highlights: ['Principal lacuna do caso', 'Impacto na leitura clínica', `${PRO_PLAN_PRICE_COPY} por ${PRO_PLAN_PERIOD_COPY}`],
  };
}

function isPlanExpiringSoon(value, thresholdInDays = 5) {
  if (!value) {
    return false;
  }

  const expiresAt = new Date(value);

  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  const diffMs = expiresAt.getTime() - Date.now();
  const diffDays = diffMs / 86400000;

  return diffDays > 0 && diffDays <= thresholdInDays;
}

function getTodayUtcDate() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function parseUtcDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWeekStartUtc(date) {
  const nextDate = new Date(date.getTime());
  const dayOfWeek = nextDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  nextDate.setUTCDate(nextDate.getUTCDate() + diffToMonday);
  nextDate.setUTCHours(0, 0, 0, 0);
  return nextDate;
}

function normalizeUiText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function areMessagesRedundant(primary, secondary) {
  const primaryTokens = normalizeUiText(primary)
    .split(/\W+/)
    .filter((token) => token.length >= 5);
  const secondaryTokens = new Set(
    normalizeUiText(secondary)
      .split(/\W+/)
      .filter((token) => token.length >= 5)
  );

  const overlapCount = primaryTokens.filter((token) => secondaryTokens.has(token)).length;
  return overlapCount >= 3;
}

function getPerformanceMessage(score) {
  if (!isValidScoreValue(score)) {
    return '';
  }

  if (score < 50) {
    return 'Existem falhas críticas que podem comprometer a avaliação clínica.';
  }

  if (score < 70) {
    return 'Há lacunas importantes que podem alterar sua conduta.';
  }

  if (score < 85) {
    return 'Pequenos ajustes podem aumentar a segurança da sua avaliação.';
  }

  return 'Sua anamnese já está bem estruturada, mas pode ficar ainda mais precisa.';
}

function getFriendlyInsightsError(response) {
  if (response?.status === 401) {
    return 'Entre na sua conta para visualizar a análise completa.';
  }

  if (response?.status === 402 && response?.data?.paywall) {
    return response.error || 'A análise completa está disponível no plano profissional.';
  }

  if (response?.status === 403) {
    return response?.error || 'A análise completa está disponível no plano profissional.';
  }

  if (response?.status >= 500) {
    return 'A análise não ficou disponível agora. Seu resultado estruturado continua pronto para uso.';
  }

  return response?.error || 'A análise não ficou disponível agora. Seu resultado estruturado continua pronto para uso.';
}

function getRelevantGapsCount(score) {
  if (!isValidScoreValue(score)) {
    return 2;
  }

  if (score >= 85) {
    return 1;
  }

  if (score >= 70) {
    return 2;
  }

  if (score >= 55) {
    return 3;
  }

  return 4;
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim().toLowerCase());
}

function getAuthErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || '').toLowerCase();
  const status = error?.status;

  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Tente entrar na sua conta.';
  }

  if (message.includes('signup is disabled')) {
    return 'O cadastro está indisponível no momento.';
  }

  if (message.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (message.includes('unable to validate email address')) {
    return 'Informe um e-mail válido.';
  }

  if (status === 429) {
    return 'Muitas tentativas em sequência. Aguarde um momento e tente novamente.';
  }

  return fallbackMessage;
}

function readAuthReturnParams() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);

  return {
    type: hashParams.get('type') || searchParams.get('type') || '',
    error: hashParams.get('error') || searchParams.get('error') || '',
    errorCode: hashParams.get('error_code') || searchParams.get('error_code') || '',
    errorDescription:
      hashParams.get('error_description') || searchParams.get('error_description') || '',
  };
}

function safeDecodeUrlValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function getRecoveryLinkState() {
  const { type, error, errorCode, errorDescription } = readAuthReturnParams();
  const normalizedError = String(error || '').toLowerCase();
  const normalizedCode = String(errorCode || '').toLowerCase();
  const normalizedDescription = safeDecodeUrlValue(errorDescription).toLowerCase();

  const hasRecoveryError = Boolean(
    normalizedError ||
      normalizedCode ||
      normalizedDescription.includes('invalid or has expired') ||
      normalizedDescription.includes('expired') ||
      normalizedDescription.includes('already') ||
      normalizedDescription.includes('used')
  );

  if (hasRecoveryError) {
    return {
      kind: 'recovery_error',
      message: 'O link de recuperação expirou ou já foi utilizado. Solicite um novo e-mail.',
    };
  }

  if (type === 'recovery') {
    return {
      kind: 'recovery',
      message: 'Defina uma nova senha para concluir a recuperação da sua conta.',
    };
  }

  return {
    kind: 'none',
    message: '',
  };
}

function clearAuthReturnStateFromUrl() {
  const url = new URL(window.location.href);
  const authSearchParams = [
    'type',
    'error',
    'error_code',
    'error_description',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
  ];

  authSearchParams.forEach((param) => {
    url.searchParams.delete(param);
  });

  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function openRecoveryResetFlow(message) {
  return {
    authMode: 'resetPassword',
    authPanelAberto: true,
    password: '',
    confirmPassword: '',
    authError: '',
    authFeedback: message,
  };
}

function openRecoveryRequestFlow(message) {
  return {
    authMode: 'forgotPassword',
    authPanelAberto: true,
    password: '',
    confirmPassword: '',
    authError: message,
    authFeedback: '',
  };
}

function isPasswordRecoveryFlow() {
  return getRecoveryLinkState().kind === 'recovery';
}

function App() {
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const textoInputRef = useRef(null);
  const insightsSectionRef = useRef(null);
  const improveActionLockRef = useRef(false);
  const trackedEventsRef = useRef(new Set());
  const trackingSessionIdRef = useRef(getOrCreateTrackingSessionId());
  const profileHydratedUserRef = useRef(null);
  const lastSavedProfileSnapshotRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [checkoutLoadingOrigin, setCheckoutLoadingOrigin] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [erro, setErro] = useState('');
  const [insightError, setInsightError] = useState('');
  const [checkoutErrors, setCheckoutErrors] = useState({
    home: '',
    profile: '',
    templates: '',
  });
  const [authError, setAuthError] = useState('');
  const [authFeedback, setAuthFeedback] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingAnamneseStats, setLoadingAnamneseStats] = useState(false);
  const [loadingAnamneseActivity, setLoadingAnamneseActivity] = useState(false);
  const [loadingRecentAnamneses, setLoadingRecentAnamneses] = useState(false);
  const [secaoSecundariaAberta, setSecaoSecundariaAberta] = useState(false);
  const [authPanelAberto, setAuthPanelAberto] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('guide');
  const [currentPage, setCurrentPage] = useState('home');
  const [anamneseStats, setAnamneseStats] = useState(null);
  const [anamneseActivity, setAnamneseActivity] = useState([]);
  const [recentAnamneses, setRecentAnamneses] = useState([]);
  const [latestScoreComparison, setLatestScoreComparison] = useState(null);
  const [qualityScore, setQualityScore] = useState(() => createEmptyQualityScore());
  const [planComparisonState, setPlanComparisonState] = useState({ open: false, origin: 'home' });
  const [freeInsightConfirmState, setFreeInsightConfirmState] = useState({ open: false, origin: 'home' });
  const [checkoutSuccessBannerVisible, setCheckoutSuccessBannerVisible] = useState(false);
  const [currentInsightsUnlocked, setCurrentInsightsUnlocked] = useState(false);

  const templateTemCalculadora = templateSelecionado === TEMPLATE_WITH_CALCULATORS;
  const accessState = useMemo(() => deriveAccessState(user, profile), [profile, user]);
  const isPro = Boolean(accessState?.hasActiveProAccess);

  useEffect(() => {
    if (user) {
      if (authMode === 'resetPassword') {
        return;
      }

      return;
    }

    if (!authPanelAberto) {
      return;
    }

    if (authMode === 'login' || authMode === 'signup' || authMode === 'forgotPassword') {
      emailInputRef.current?.focus();
      return;
    }

    passwordInputRef.current?.focus();
  }, [authMode, authPanelAberto, user]);

  useEffect(() => {
    async function carregarSessao() {
      setLoadingUser(true);
      const recoveryState = getRecoveryLinkState();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setErro('Não foi possível carregar sua sessão.');
      }

      setUser(data.session?.user || null);

      if (recoveryState.kind === 'recovery_error') {
        setAuthMode(openRecoveryRequestFlow(recoveryState.message).authMode);
        setAuthPanelAberto(true);
        setPassword('');
        setConfirmPassword('');
        setAuthError(recoveryState.message);
        setAuthFeedback('');
        clearAuthReturnStateFromUrl();
      } else if (recoveryState.kind === 'recovery' && data.session?.user) {
        const nextState = openRecoveryResetFlow(recoveryState.message);
        setAuthMode(nextState.authMode);
        setAuthPanelAberto(nextState.authPanelAberto);
        setPassword(nextState.password);
        setConfirmPassword(nextState.confirmPassword);
        setAuthError(nextState.authError);
        setAuthFeedback(nextState.authFeedback);
        clearAuthReturnStateFromUrl();
      }

      setLoadingUser(false);
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const recoveryState = getRecoveryLinkState();
      setUser(session?.user || null);
      setLoadingUser(false);

      if (event === 'PASSWORD_RECOVERY') {
        const nextState = openRecoveryResetFlow(
          recoveryState.kind === 'recovery' ? recoveryState.message : 'Defina uma nova senha para concluir a recuperação da sua conta.'
        );
        setAuthMode(nextState.authMode);
        setAuthPanelAberto(nextState.authPanelAberto);
        setPassword(nextState.password);
        setConfirmPassword(nextState.confirmPassword);
        setAuthError(nextState.authError);
        setAuthFeedback(nextState.authFeedback);
        clearAuthReturnStateFromUrl();
        return;
      }

      if (recoveryState.kind === 'recovery_error') {
        const nextState = openRecoveryRequestFlow(recoveryState.message);
        setAuthMode(nextState.authMode);
        setAuthPanelAberto(nextState.authPanelAberto);
        setPassword(nextState.password);
        setConfirmPassword(nextState.confirmPassword);
        setAuthError(nextState.authError);
        setAuthFeedback(nextState.authFeedback);
        clearAuthReturnStateFromUrl();
        return;
      }

      if (session?.user) {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAuthMode('login');
        setAuthError('');
        setAuthFeedback('');
        setAuthPanelAberto(false);
      } else {
        setProfile(null);
        profileHydratedUserRef.current = null;
        lastSavedProfileSnapshotRef.current = null;
        trackingSessionIdRef.current = resetTrackingSessionId();
        trackedEventsRef.current.clear();
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
        setQualityScore(normalizeQualityScorePayload(returnState.qualityScore));
        setCurrentPage(returnState.page || 'home');
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
      setCheckoutSuccessBannerVisible(true);
      clearCheckoutReturnState();
    }

    atualizarSessaoAposCheckout();
  }, []);

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

  useEffect(() => {
    carregarTemplates();
  }, [user?.id]);

  useEffect(() => {
    async function carregarPerfil() {
      if (!user?.id) {
        setProfile(null);
        profileHydratedUserRef.current = null;
        lastSavedProfileSnapshotRef.current = null;
        return;
      }

      const response = await api.get('/profile');

      if (!response.success || !response.data) {
        return;
      }

      const nextProfile = response.data;
      const nextContextualTab = normalizeContextualTab(nextProfile.default_contextual_tab);
      setProfile(nextProfile);
      lastSavedProfileSnapshotRef.current = {
        current_plan: nextProfile.current_plan || 'basic',
        last_template_used: nextProfile.last_template_used || null,
        default_contextual_tab: nextContextualTab,
      };

      if (profileHydratedUserRef.current === user.id) {
        return;
      }

      if (!templateSelecionado && nextProfile.last_template_used) {
        setTemplateSelecionado(nextProfile.last_template_used);
      }

      if (activeSidebarTab === 'guide' && nextContextualTab) {
        setActiveSidebarTab(nextContextualTab);
      }

      profileHydratedUserRef.current = user.id;
    }

    carregarPerfil();
  }, [user?.id, user?.user_metadata?.plan]);

  useEffect(() => {
    if (!user?.id || profileHydratedUserRef.current !== user.id) {
      return;
    }

    const nextSnapshot = {
      current_plan: profile?.current_plan || (user?.user_metadata?.plan === 'pro' ? 'pro' : 'basic'),
      last_template_used: templateSelecionado || null,
      default_contextual_tab: normalizeContextualTab(activeSidebarTab),
    };

    const lastSnapshot = lastSavedProfileSnapshotRef.current;

    if (
      lastSnapshot &&
      lastSnapshot.current_plan === nextSnapshot.current_plan &&
      lastSnapshot.last_template_used === nextSnapshot.last_template_used &&
      lastSnapshot.default_contextual_tab === nextSnapshot.default_contextual_tab
    ) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const response = await api.post('/profile', {
        last_template_used: nextSnapshot.last_template_used,
        default_contextual_tab: nextSnapshot.default_contextual_tab,
      });

      if (response.success && response.data) {
        setProfile(response.data);
        lastSavedProfileSnapshotRef.current = {
          current_plan: response.data.current_plan || nextSnapshot.current_plan,
          last_template_used: response.data.last_template_used || null,
          default_contextual_tab: normalizeContextualTab(response.data.default_contextual_tab),
        };
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [user?.id, user?.user_metadata?.plan, profile?.current_plan, templateSelecionado, activeSidebarTab]);

  useEffect(() => {
    async function carregarStatsAnamneses() {
      if (!user?.id) {
        setAnamneseStats(null);
        setLoadingAnamneseStats(false);
        return;
      }

      setLoadingAnamneseStats(true);
      const response = await api.get('/anamneses?view=stats');

      if (response.success && response.data && typeof response.data === 'object') {
        const nextStats = {
          total_anamneses: typeof response.data.total_anamneses === 'number' ? response.data.total_anamneses : 0,
          score_medio: isValidScoreValue(response.data.score_medio) ? response.data.score_medio : null,
          melhor_score: isValidScoreValue(response.data.melhor_score) ? response.data.melhor_score : null,
          ultimo_score: isValidScoreValue(response.data.ultimo_score) ? response.data.ultimo_score : null,
          score_anterior: isValidScoreValue(response.data.score_anterior) ? response.data.score_anterior : null,
        };

        setAnamneseStats(nextStats);
      } else {
        setAnamneseStats(null);
      }

      setLoadingAnamneseStats(false);
    }

    carregarStatsAnamneses();
  }, [user?.id, resultado]);

  useEffect(() => {
    async function carregarAtividadeAnamneses() {
      if (!user?.id) {
        setAnamneseActivity([]);
        setLoadingAnamneseActivity(false);
        return;
      }

      setLoadingAnamneseActivity(true);
      const response = await api.get('/anamneses?view=activity');

      if (response.success && Array.isArray(response.data)) {
        setAnamneseActivity(
          response.data.filter((item) => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item))
        );
      } else {
        setAnamneseActivity([]);
      }

      setLoadingAnamneseActivity(false);
    }

    carregarAtividadeAnamneses();
  }, [user?.id, resultado]);

  useEffect(() => {
    async function carregarAnamnesesRecentes() {
      if (!user?.id) {
        setRecentAnamneses([]);
        setLoadingRecentAnamneses(false);
        return;
      }

      setLoadingRecentAnamneses(true);
      const response = await api.get('/anamneses');

      if (response.success && Array.isArray(response.data)) {
        const sanitized = response.data.filter((item) => (
          item &&
          typeof item.id === 'string' &&
          typeof item.template === 'string' &&
          typeof item.score === 'number' &&
          typeof item.created_at === 'string'
        ));

        setRecentAnamneses(sanitized);
      } else {
        setRecentAnamneses([]);
      }

      setLoadingRecentAnamneses(false);
    }

    carregarAnamnesesRecentes();
  }, [user?.id, resultado]);

  useEffect(() => {
    if (user) {
      setAuthPanelAberto(false);
      return;
    }

    if (authError || authFeedback) {
      setAuthPanelAberto(true);
    }
  }, [authError, authFeedback, user]);

  useEffect(() => {
    setCheckoutErrors({
      home: '',
      profile: '',
      templates: '',
    });
  }, [currentPage]);

  const handleTemplateChange = (e) => {
    const novoTemplate = e.target.value;
    setTemplateSelecionado(novoTemplate);
    setActiveSidebarTab('guide');
    setCurrentInsightsUnlocked(false);
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setAuthPanelAberto(false);
    setCheckoutErrors({
      home: '',
      profile: '',
      templates: '',
    });
  };

  const handleUseTemplateFromLibrary = (templateId) => {
    setTemplateSelecionado(templateId);
    setCurrentPage('home');
    setActiveSidebarTab('guide');

    window.setTimeout(() => {
      textoInputRef.current?.focus();
    }, 0);
  };

  const handleOrganizar = async () => {
    setErro('');
    setInsightError('');
    setResultado('');
    setLatestScoreComparison(null);
    setQualityScore(createEmptyQualityScore());
    setCurrentInsightsUnlocked(false);

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
        const organizedResult = response.data.resultado || '';
        setResultado(organizedResult);
        setLatestScoreComparison(response.data.comparison || null);
        setSecaoSecundariaAberta(false);
        trackEvent('anamnese_gerada', {
          template: templateSelecionado,
          text_length: texto.trim().length,
          is_pro: isPro,
        });
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
    setLatestScoreComparison(null);
    setQualityScore(createEmptyQualityScore());
    setErro('');
    setInsightError('');
    setActiveSidebarTab('guide');
    setCurrentInsightsUnlocked(false);
    trackedEventsRef.current.clear();
  };

  const handleMelhorarAnamnese = async () => {
    if (!texto.trim() || loadingInsights || improveActionLockRef.current) {
      return;
    }

    improveActionLockRef.current = true;

    try {
      if (!qualityScore.criticalInsight && !qualityScore.justification) {
        await handleGerarInsights();

        window.setTimeout(() => {
          insightsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }

      textoInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        textoInputRef.current?.focus();
        textoInputRef.current?.select?.();
      }, 120);
    } finally {
      window.setTimeout(() => {
        improveActionLockRef.current = false;
      }, 500);
    }
  };

  const handleCopiar = async () => {
    if (!resultado) return;

    const textToCopy = displayedResultado || resultado;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleGerarInsights = async (organizedText = resultado) => {
    const targetResultado = typeof organizedText === 'string' ? organizedText : resultado;

    if (!targetResultado.trim() || !templateSelecionado) {
      setInsightError('Gere a anamnese estruturada antes de pedir a análise.');
      return { success: false, status: 400 };
    }

    setInsightError('');
    setLoadingInsights(true);
    trackEvent('cta_avaliacao_click', {
      template: templateSelecionado,
      text_length: targetResultado.trim().length,
      score: qualityScore.score,
      is_pro: isPro,
    });

    try {
      const response = await api.post('/insights', {
        texto: targetResultado,
        templateId: templateSelecionado,
      });

      if (response.success) {
        const normalizedQualityScore = normalizeQualityScorePayload(response.data);
        setQualityScore(normalizedQualityScore);
        setCurrentInsightsUnlocked(true);
        if (response.data?.profile) {
          setProfile(response.data.profile);
        }
        trackEvent('insight_gerado', {
          template: templateSelecionado,
          text_length: targetResultado.trim().length,
          score: normalizedQualityScore.score,
          is_pro: isPro,
        });
        return { success: true, status: response.status };
      } else {
        if (response.data?.profile) {
          setProfile(response.data.profile);
        }
        setQualityScore(createEmptyQualityScore());
        setCurrentInsightsUnlocked(false);
        setInsightError(getFriendlyInsightsError(response));
        return { success: false, status: response.status, response };
      }
    } catch (_err) {
      setCurrentInsightsUnlocked(false);
      setInsightError('A análise não ficou disponível agora. Seu resultado estruturado continua pronto para uso.');
      return { success: false, status: 0 };
    } finally {
      setLoadingInsights(false);
    }
  };

  const startCheckoutFlow = async (origin = 'home') => {
    if (!user?.id || !user?.email) {
      setAuthPanelAberto(true);
      setAuthMode('login');
      setAuthError('');
      setCheckoutErrors((current) => ({
        ...current,
        [origin]: '',
      }));
      return;
    }

    setErro('');
    setCheckoutErrors((current) => ({
      ...current,
      [origin]: '',
    }));
    setCheckoutLoadingOrigin(origin);
    trackEvent('upgrade_click', {
      template: templateSelecionado || null,
      text_length: resultado.trim().length || texto.trim().length,
      score: qualityScore.score,
      is_pro: isPro,
    });
    saveCheckoutReturnState({
      page: origin === 'profile' ? 'profile' : currentPage,
      templateSelecionado,
      texto,
      resultado,
      qualityScore,
    });

    api
      .post('/create-checkout', {})
      .then((response) => {
        if (!response.success || !response.data?.init_point) {
          throw new Error(response.error || 'Não foi possível iniciar o pagamento');
        }

        window.location.href = response.data.init_point;
      })
      .catch((error) => {
        setCheckoutErrors((current) => ({
          ...current,
          [origin]: error.message || 'Não foi possível iniciar o pagamento',
        }));
        setCheckoutLoadingOrigin(null);
      });
  };

  const handleUpgradeInsights = (origin = 'home') => {
    if (!user?.id || !user?.email) {
      setAuthPanelAberto(true);
      setAuthMode('login');
      setAuthError('');
      setCheckoutErrors((current) => ({
        ...current,
        [origin]: '',
      }));
      return;
    }

    if (origin === 'home' && accessState?.hasFreeFullInsightAvailable && resultado && templateSelecionado) {
      setFreeInsightConfirmState({ open: true, origin });
      return;
    }

    setPlanComparisonState({ open: true, origin });
  };

  const handleUpgradeTemplates = () => {
    handleUpgradeInsights('templates');
  };

  const handleAnalysisAccessAction = async (origin = 'home') => {
    if (accessState?.hasActiveProAccess && resultado && templateSelecionado) {
      await handleGerarInsights();
      return;
    }

    if (accessState?.hasFreeFullInsightAvailable && user?.id && resultado && templateSelecionado) {
      const insightsResult = await handleGerarInsights();

      if (insightsResult?.success || insightsResult?.status !== 402) {
        return;
      }
    }

    handleUpgradeInsights(origin);
  };

  const handleConfirmFreeInsight = async () => {
    setFreeInsightConfirmState((current) => ({
      ...current,
      open: false,
    }));
    await handleGerarInsights();
  };

  const handleConfirmPlanComparison = async () => {
    const origin = planComparisonState.origin || 'home';
    setPlanComparisonState((current) => ({
      ...current,
      open: false,
    }));
    await startCheckoutFlow(origin);
  };

  const resetAuthFormState = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(false);
  };

  const handleChangeAuthMode = (nextMode) => {
    setAuthMode(nextMode);
    if (nextMode !== 'forgotPassword') {
      setPassword('');
      setConfirmPassword('');
    }
    setAuthError('');
    setAuthFeedback('');
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setAuthError('Informe um e-mail válido.');
      return;
    }

    if (!password.trim()) {
      setAuthError('Informe sua senha.');
      return;
    }

    if (loadingAuth) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error, 'Não foi possível entrar com este e-mail e senha.'));
      setLoadingAuth(false);
      return;
    }

    resetAuthFormState();
    setLoadingAuth(false);
  };

  const handleSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setAuthError('Informe um e-mail válido.');
      return;
    }

    if (password.trim().length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    if (loadingAuth) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error, 'Não foi possível criar sua conta agora.'));
      setLoadingAuth(false);
      return;
    }

    if (data?.session?.user) {
      resetAuthFormState();
      setLoadingAuth(false);
      return;
    }

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setAuthError('Este e-mail já está cadastrado. Tente entrar na sua conta.');
      setLoadingAuth(false);
      return;
    }

    setAuthFeedback('Conta criada com sucesso. Agora entre com seu e-mail e senha.');
    setPassword('');
    setConfirmPassword('');
    setAuthMode('login');
    setLoadingAuth(false);
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setAuthError('Informe um e-mail válido.');
      return;
    }

    if (loadingAuth) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error, 'Não foi possível enviar a recuperação de senha.'));
      setLoadingAuth(false);
      return;
    }

    setAuthFeedback('Enviamos as instruções de recuperação para o seu e-mail.');
    setLoadingAuth(false);
  };

  const handleResetPassword = async () => {
    if (password.trim().length < 6) {
      setAuthError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    if (loadingAuth) {
      return;
    }

    setErro('');
    setAuthError('');
    setAuthFeedback('');
    setLoadingAuth(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error, 'Não foi possível salvar sua nova senha agora.'));
      setLoadingAuth(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setAuthFeedback('Senha atualizada com sucesso. Você já pode continuar usando sua conta normalmente.');
    setLoadingAuth(false);

    window.setTimeout(() => {
      setAuthPanelAberto(false);
      setAuthMode('login');
      setAuthFeedback('');
    }, 1200);
  };

  const handleSair = async () => {
    setLoadingUser(true);
    await supabase.auth.signOut();
    trackingSessionIdRef.current = resetTrackingSessionId();
    trackedEventsRef.current.clear();
    resetAuthFormState();
    setAuthMode('login');
    setLoadingUser(false);
  };

  const hasFinalInterpretation = Boolean(
    qualityScore.message || qualityScore.justification || qualityScore.criticalInsight
  );
  const homeCheckoutError = checkoutErrors.home;
  const profileCheckoutError = checkoutErrors.profile;
  const templatesCheckoutError = checkoutErrors.templates;
  const isHomeCheckoutLoading = checkoutLoadingOrigin === 'home';
  const isProfileCheckoutLoading = checkoutLoadingOrigin === 'profile';
  const paywallUi = getPaywallUiConfig(user, accessState);
  const isProExpiringSoon = accessState?.hasActiveProAccess && isPlanExpiringSoon(accessState?.planExpiresAt);
  const canRequestInsights = Boolean(
    user &&
    (accessState?.hasActiveProAccess || accessState?.hasFreeFullInsightAvailable) &&
    resultado &&
    templateSelecionado
  );
  const shouldShowPaywall =
    hasFinalInterpretation && !accessState?.hasActiveProAccess && !currentInsightsUnlocked;
  const analysisInputSection = qualityScore.justification;
  const summarizedScoreJustification = qualityScore.message;
  const insightPrincipalSection = qualityScore.criticalInsight;
  const primaryGapsCopy = qualityScore.justification;
  const secondaryGaps = qualityScore.otherGaps.filter((gap) => {
    if (!gap) {
      return false;
    }

    if (!primaryGapsCopy) {
      return true;
    }

    return !areMessagesRedundant(primaryGapsCopy, gap);
  });
  const displayedResultado = useMemo(() => sanitizeAnamnesisForDisplay(resultado), [resultado]);
  const userDisplayName = user ? getUserDisplayName(user) : '';
  const templateAtual = templates.find((template) => template.id === templateSelecionado) || null;
  const profileTemplateAtual =
    templates.find((template) => template.id === profile?.last_template_used) || null;
  const selectedGuideItems = Array.isArray(templateAtual?.guide) && templateAtual.guide.length
    ? templateAtual.guide
    : guides[templateSelecionado] || [];
  const textPlaceholder =
    formatBaseExamplePlaceholder(templateAtual?.baseExample) ||
    TEMPLATE_TEXT_PLACEHOLDERS[templateSelecionado] ||
    DEFAULT_TEXT_PLACEHOLDER;
  const possuiGuiaSelecionado = selectedGuideItems.length > 0;
  const improvementBoxCopy = 'Revise o texto atual, faça ajustes e gere uma nova versão quando quiser.';
  const improvementButtonLabel = isPro ? 'Refinar minha anamnese' : 'Melhorar minha anamnese';
  const performanceMessage = getPerformanceMessage(qualityScore.score);
  const relevantGapsCount = secondaryGaps.length > 0
    ? secondaryGaps.length + (qualityScore.criticalInsight ? 1 : 0)
    : getRelevantGapsCount(qualityScore.score);
  const consistencySummary = useMemo(() => {
    if (!user) {
      return null;
    }

    const today = getTodayUtcDate();
    const currentWeekStart = getWeekStartUtc(today);
    const last30DaysStart = new Date(today.getTime());
    last30DaysStart.setUTCDate(last30DaysStart.getUTCDate() - 29);

    const validDates = anamneseActivity
      .map((value) => parseUtcDateString(value))
      .filter(Boolean)
      .sort((left, right) => left.getTime() - right.getTime());

    const activeDaysLast30 = validDates.filter((date) => date >= last30DaysStart && date <= today).length;
    const activeWeeksLast4 = new Set(
      validDates
        .filter((date) => date >= new Date(currentWeekStart.getTime() - 21 * 86400000) && date <= today)
        .map((date) => getWeekStartUtc(date).toISOString().slice(0, 10))
    ).size;
    const hasActivityThisWeek = validDates.some((date) => date >= currentWeekStart && date <= today);

    if (activeDaysLast30 > 0) {
      return {
        title: `Voc\u00ea registrou atividade em ${activeDaysLast30} ${activeDaysLast30 === 1 ? 'dia' : 'dias'} nos \u00faltimos 30 dias`,
        details: [
          activeWeeksLast4 > 0
            ? `Sua rotina apareceu em ${activeWeeksLast4} ${activeWeeksLast4 === 1 ? 'das \u00faltimas 4 semanas' : 'das \u00faltimas 4 semanas'}`
            : null,
          hasActivityThisWeek ? 'Voc\u00ea j\u00e1 registrou atividade nesta semana' : null,
        ].filter(Boolean),
      };
    }

    return {
      title: 'Sua consist\u00eancia vai aparecer aqui conforme voc\u00ea voltar ao app',
      details: ['Cada dia com atividade entra nessa leitura, sem exigir uso di\u00e1rio.'],
    };
  }, [anamneseActivity, user]);
  const hasEvolutionData = Boolean(
    latestScoreComparison ||
    (anamneseStats?.total_anamneses || 0) > 0 ||
    anamneseActivity.length > 0
  );
  const shouldShowUserEvolution = Boolean(
    user && (loadingAnamneseStats || loadingAnamneseActivity || hasEvolutionData)
  );
  const hasSecondaryContent = Boolean(hasFinalInterpretation && !shouldShowPaywall);
  const shouldShowFeedback = Boolean(resultado);

  const trackEvent = async (eventName, metadata = {}, options = {}) => {
    const eventKey = options.eventKey || null;
    const sessionId = trackingSessionIdRef.current || getOrCreateTrackingSessionId();

    if (window.location.hostname === 'localhost') {
      return;
    }

    if (eventKey && trackedEventsRef.current.has(eventKey)) {
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      const response = await fetch(`${API_BASE_URL}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          eventName,
          metadata: {
            ...metadata,
            session_id: sessionId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('tracking request failed');
      }

      if (eventKey) {
        trackedEventsRef.current.add(eventKey);
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.error('tracking: failed to register event', error);
      }
    }
  };

  useEffect(() => {
    if (!resultado || !qualityScore.shouldShowScore || qualityScore.score == null) {
      return;
    }

    const eventKey = `score_exibido:${templateSelecionado}:${resultado.length}:${qualityScore.score}`;
    trackEvent(
      'score_exibido',
      {
        template: templateSelecionado || null,
        text_length: resultado.length,
        score: qualityScore.score,
        is_pro: isPro,
              },
      { eventKey }
    );
  }, [resultado, templateSelecionado, qualityScore.shouldShowScore, qualityScore.score, isPro]);

  useEffect(() => {
    if (!qualityScore.shouldShowScore || qualityScore.score == null) {
      setAnimatedScore(0);
      return undefined;
    }

    setAnimatedScore(0);
    const frameId = window.requestAnimationFrame(() => {
      setAnimatedScore(qualityScore.score);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [qualityScore.shouldShowScore, qualityScore.score, resultado, templateSelecionado]);

  return (
    <div className="container">
      <div className="product-topbar">
        <div className="product-topbar-brand">
          <div className="product-topbar-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <div>
            <strong>Minha Anamnese</strong>
            <span>Workspace clínico</span>
          </div>
        </div>

        <nav className="product-topbar-nav" aria-label="Navegação principal">
          <button
            type="button"
            className={`product-nav-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => handleNavigate('home')}
          >
            Home
          </button>
          <button
            type="button"
            className={`product-nav-item ${currentPage === 'templates' ? 'active' : ''}`}
            onClick={() => handleNavigate('templates')}
          >
            Templates
          </button>
          <button
            type="button"
            className={`product-nav-item ${currentPage === 'evolution' ? 'active' : ''}`}
            onClick={() => handleNavigate('evolution')}
          >
            Evolução
          </button>
        </nav>

        <div className="product-topbar-actions">
          {!user && (
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setAuthPanelAberto((current) => !current)}
            >
              Entrar
            </button>
          )}

          {user && !isPro && (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => handleUpgradeInsights('home')}
              disabled={isHomeCheckoutLoading}
            >
              {isHomeCheckoutLoading
                ? 'Abrindo checkout...'
                : accessState?.hasFreeFullInsightAvailable
                  ? 'Usar análise grátis'
                  : accessState?.billingStatus === 'expired'
                    ? 'Reativar plano'
                    : 'Upgrade'}
            </button>
          )}

          {user && (
            <div className="product-profile-chip">
              <button
                type="button"
                className="product-avatar"
                onClick={() => handleNavigate('profile')}
                title="Abrir perfil"
              >
                {(userDisplayName || 'P').charAt(0)}
              </button>
              <div className="product-profile-copy">
                <strong>{userDisplayName}</strong>
                <span>{accessState?.hasActiveProAccess ? 'Plano profissional' : accessState?.billingStatus === 'expired' ? 'Profissional expirado' : 'Plano básico'}</span>
              </div>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => handleNavigate('profile')}
              >
                Perfil
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={handleSair}
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {authPanelAberto && (!user || authMode === 'resetPassword') && (
        <div className="topbar-auth-popover">
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (authMode === 'login') {
                handleLogin();
                return;
              }

              if (authMode === 'signup') {
                handleSignup();
                return;
              }

              if (authMode === 'resetPassword') {
                handleResetPassword();
                return;
              }

              handleForgotPassword();
            }}
            className="topbar-auth-form"
          >
            <div className="topbar-auth-header">
              <div>
                <strong>
                  {authMode === 'login'
                    ? 'Entre na sua conta'
                    : authMode === 'signup'
                      ? 'Crie sua conta'
                      : authMode === 'resetPassword'
                        ? 'Defina sua nova senha'
                        : 'Recuperar acesso'}
                </strong>
                <span>
                  {authMode === 'login'
                    ? 'Use seu e-mail e senha para acessar seu histórico e recursos profissionais.'
                    : authMode === 'signup'
                      ? 'Crie um acesso simples para continuar usando o produto com mais facilidade.'
                      : authMode === 'resetPassword'
                        ? 'Crie uma nova senha para concluir a recuperação e seguir usando sua conta normalmente.'
                        : 'Informe seu e-mail para receber as instruções de recuperação de senha.'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setAuthPanelAberto(false)}
              >
                Fechar
              </button>
            </div>

            {authMode !== 'resetPassword' && (
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
                disabled={loadingAuth}
                className="topbar-auth-input"
              />
            )}

            {authMode !== 'forgotPassword' && (
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) {
                    setAuthError('');
                  }
                }}
                placeholder={authMode === 'resetPassword' ? 'Nova senha' : 'Sua senha'}
                disabled={loadingAuth}
                className="topbar-auth-input"
              />
            )}

            {(authMode === 'signup' || authMode === 'resetPassword') && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (authError) {
                    setAuthError('');
                  }
                }}
                placeholder="Confirmar nova senha"
                disabled={loadingAuth}
                className="topbar-auth-input"
              />
            )}

            {authFeedback && <span className="topbar-auth-feedback">{authFeedback}</span>}
            {authError && <div className="topbar-auth-error">{authError}</div>}

            {authMode === 'login' ? (
              <button
                type="submit"
                className="btn btn-secundario"
                disabled={loadingAuth}
              >
                {loadingAuth ? 'Entrando...' : 'Entrar'}
              </button>
            ) : authMode === 'signup' ? (
              <button
                type="submit"
                className="btn btn-secundario"
                disabled={loadingAuth}
              >
                {loadingAuth ? 'Criando conta...' : 'Criar conta'}
              </button>
            ) : authMode === 'resetPassword' ? (
              <button
                type="submit"
                className="btn btn-secundario"
                disabled={loadingAuth}
              >
                {loadingAuth ? 'Salvando nova senha...' : 'Salvar nova senha'}
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-secundario"
                disabled={loadingAuth}
              >
                {loadingAuth ? 'Enviando recuperação...' : 'Enviar recuperação'}
              </button>
            )}

            <div className="topbar-auth-links">
              {authMode === 'login' && (
                <>
                  <button
                    type="button"
                    className="topbar-auth-link"
                    onClick={() => handleChangeAuthMode('forgotPassword')}
                    disabled={loadingAuth}
                  >
                    Esqueci minha senha
                  </button>
                  <button
                    type="button"
                    className="topbar-auth-link"
                    onClick={() => handleChangeAuthMode('signup')}
                    disabled={loadingAuth}
                  >
                    Criar conta
                  </button>
                </>
              )}

              {authMode === 'signup' && (
                <button
                  type="button"
                  className="topbar-auth-link"
                  onClick={() => handleChangeAuthMode('login')}
                  disabled={loadingAuth}
                >
                  Já tenho conta
                </button>
              )}

              {authMode === 'forgotPassword' && (
                <button
                  type="button"
                  className="topbar-auth-link"
                  onClick={() => handleChangeAuthMode('login')}
                  disabled={loadingAuth}
                >
                  Voltar para entrar
                </button>
              )}

              {authMode === 'resetPassword' && (
                <button
                  type="button"
                  className="topbar-auth-link"
                  onClick={() => {
                    setAuthPanelAberto(false);
                    handleChangeAuthMode('login');
                  }}
                  disabled={loadingAuth}
                >
                  Fechar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {currentPage === 'home' && (
        <div className="workspace-shell">
          <div className="workspace-intro workspace-surface">
            <div className="workspace-intro-copy">
              <span className="workspace-kicker">Fluxo principal</span>
              <h1>Monte sua anamnese</h1>
              <p>Selecione o modelo, escreva a coleta em texto livre e transforme tudo em um resultado clínico mais claro e pronto para revisar.</p>
            </div>

            <div className="workspace-meta-list" aria-label="Resumo do workspace">
              <div className="workspace-meta-item">
                <span>Modelo</span>
                <strong>{templateAtual?.nome || 'Selecione para começar'}</strong>
              </div>
              <div className="workspace-meta-item">
                <span>Status</span>
                <strong>{resultado ? 'Resultado pronto para revisão' : 'Pronto para começar'}</strong>
              </div>
            </div>
          </div>

          {checkoutSuccessBannerVisible && accessState?.hasActiveProAccess && (
            <CheckoutSuccessBanner
              isExpiringSoon={isProExpiringSoon}
              planExpiresAt={accessState?.planExpiresAt}
              onDismiss={() => setCheckoutSuccessBannerVisible(false)}
              onViewAnalysis={() => {
                setCheckoutSuccessBannerVisible(false);
                if (resultado && templateSelecionado) {
                  handleGerarInsights();
                }
              }}
              onGoProfile={() => {
                setCheckoutSuccessBannerVisible(false);
                handleNavigate('profile');
              }}
            />
          )}

          <div className="workspace-grid">
            <div className="conteudo-principal">
              <InputSection
                templates={templates}
                templateSelecionado={templateSelecionado}
                onTemplateChange={handleTemplateChange}
                loadingTemplates={loadingTemplates}
                texto={texto}
                onTextoChange={setTexto}
                inputRef={textoInputRef}
                placeholder={textPlaceholder}
                possuiGuiaSelecionado={possuiGuiaSelecionado}
                templateTemCalculadora={templateTemCalculadora}
                onOpenCalculadora={() => setActiveSidebarTab('calculator')}
                loading={loading}
                loadingInsights={loadingInsights}
                onOrganizar={handleOrganizar}
                onLimpar={handleLimpar}
                erro={erro}
                onDismissErro={() => setErro('')}
              />

              {resultado && (
                <StructuredOutput
                  displayedResultado={displayedResultado}
                  copiado={copiado}
                  onCopiar={handleCopiar}
                />
              )}

              {shouldShowFeedback && (
                <StructuralFeedback
                  qualityScore={qualityScore}
                  animatedScore={animatedScore}
                  primaryGapsCopy={primaryGapsCopy}
                  secondaryGaps={secondaryGaps}
                  insightError={insightError}
                  hasFinalInterpretation={hasFinalInterpretation}
                  improvementBoxCopy={improvementBoxCopy}
                  improvementButtonLabel={improvementButtonLabel}
                  onMelhorarAnamnese={handleMelhorarAnamnese}
                  onPaywallAction={() => handleAnalysisAccessAction('home')}
                  paywallTitle={paywallUi.title}
                  paywallDescription={paywallUi.description}
                  paywallButtonLabel={paywallUi.buttonLabel}
                  checkoutError={homeCheckoutError}
                  canImprove={Boolean(texto.trim())}
                  loadingCheckout={isHomeCheckoutLoading}
                  loadingInsights={loadingInsights}
                  showAnalyzeAction={canRequestInsights && !hasFinalInterpretation}
                  onGerarInsights={() => {
                    if (accessState?.hasFreeFullInsightAvailable) {
                      handleUpgradeInsights('home');
                      return;
                    }

                    handleGerarInsights();
                  }}
                />
              )}

              {hasFinalInterpretation && (
                <InsightBlock
                  insightsSectionRef={insightsSectionRef}
                  insightPrincipalSection={insightPrincipalSection}
                  shouldShowPaywall={shouldShowPaywall}
                  performanceMessage={performanceMessage}
                  relevantGapsCount={relevantGapsCount}
                  onPaywallAction={() => handleAnalysisAccessAction('home')}
                  loadingCheckout={isHomeCheckoutLoading}
                  checkoutError={homeCheckoutError}
                  paywallTitle={paywallUi.title}
                  paywallDescription={paywallUi.description}
                  paywallButtonLabel={paywallUi.buttonLabel}
                  paywallHighlights={paywallUi.highlights}
                />
              )}

              {hasSecondaryContent && (
                <DetailedAnalysis
                  aberto={secaoSecundariaAberta}
                  onToggle={() => setSecaoSecundariaAberta((current) => !current)}
                  showDetailedContent={hasFinalInterpretation && !shouldShowPaywall}
                  analysisInputSection={analysisInputSection}
                  summarizedScoreJustification={summarizedScoreJustification}
                  insightPrincipalSection={insightPrincipalSection}
                  secondaryGaps={secondaryGaps}
                />
              )}

              {shouldShowUserEvolution && (
                <UserEvolution
                  loadingAnamneseStats={loadingAnamneseStats}
                  anamneseStats={anamneseStats}
                  isValidScoreValue={isValidScoreValue}
                  loadingAnamneseActivity={loadingAnamneseActivity}
                  consistencySummary={consistencySummary}
                  currentScore={qualityScore.score}
                  immediateComparison={latestScoreComparison}
                />
              )}
            </div>

            <WorkspaceSidebar
              activeTab={activeSidebarTab}
              onChangeTab={setActiveSidebarTab}
              templateSelecionado={templateSelecionado}
              templateNome={templateAtual?.nome}
              guideItems={selectedGuideItems}
              templateTemCalculadora={templateTemCalculadora}
            />
          </div>
        </div>
      )}

      {currentPage === 'templates' && (
        <TemplatesPage
          templates={templates}
          loadingTemplates={loadingTemplates}
          selectedTemplateId={templateSelecionado}
          onUseTemplate={handleUseTemplateFromLibrary}
          onTemplatesRefresh={carregarTemplates}
          isPro={isPro}
          loadingCheckout={checkoutLoadingOrigin === 'templates'}
          checkoutError={templatesCheckoutError}
          onRequestUpgrade={handleUpgradeTemplates}
        />
      )}

      {currentPage === 'evolution' && (
        <EvolutionPage
          user={user}
          templates={templates}
          loadingAnamneseStats={loadingAnamneseStats}
          anamneseStats={anamneseStats}
          loadingAnamneseActivity={loadingAnamneseActivity}
          anamneseActivity={anamneseActivity}
          loadingRecentAnamneses={loadingRecentAnamneses}
          recentAnamneses={recentAnamneses}
          consistencySummary={consistencySummary}
          onGoHome={() => handleNavigate('home')}
          onGoTemplates={() => handleNavigate('templates')}
        />
      )}

      {currentPage === 'profile' && (
        <ProfilePage
          user={user}
          profile={profile}
          accessState={accessState}
          selectedTemplateName={templateAtual?.nome || profileTemplateAtual?.nome || ''}
          activeSidebarTab={profile?.default_contextual_tab || activeSidebarTab}
          onUpgrade={() => handleUpgradeInsights('profile')}
          onSignOut={handleSair}
          onGoHome={() => handleNavigate('home')}
          onGoTemplates={() => handleNavigate('templates')}
          loadingCheckout={isProfileCheckoutLoading}
          checkoutError={profileCheckoutError}
        />
      )}

      <footer className="footer">
        <p>Minha Anamnese &middot; Apoio à padronização clínica &middot; Evite dados identificáveis; o texto é processado por IA e não é salvo como prontuário</p>
      </footer>

      <FreeInsightConfirmModal
        open={freeInsightConfirmState.open}
        loading={loadingInsights}
        onClose={() => setFreeInsightConfirmState((current) => ({ ...current, open: false }))}
        onConfirm={handleConfirmFreeInsight}
      />

      <PlanComparisonModal
        open={planComparisonState.open}
        loading={checkoutLoadingOrigin === planComparisonState.origin}
        onClose={() => setPlanComparisonState((current) => ({ ...current, open: false }))}
        onConfirm={handleConfirmPlanComparison}
      />
    </div>
  );
}

export default App;


