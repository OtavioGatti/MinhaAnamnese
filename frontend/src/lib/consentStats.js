// Contagem anônima do banner de cookies: quantas vezes ele foi mostrado,
// aceito e recusado, por dia (tabela public.consent_stats).
//
// Roda ANTES da resposta do banner de propósito, por isso só pode levar dado
// anonimizado (LGPD, art. 12). O navegador manda quatro palavras de uma lista
// fechada e a função do banco (consent_stats_increment) soma +1 na linha do
// dia. Não vai IP, user agent, id de usuário, sessão, cookie nem horário: o
// user agent é lido aqui, no aparelho, e só sai reduzido a celular/desktop e ao
// nome do app. Nada é gravado no aparelho (sem cookie, sem localStorage).
//
// Exceção consciente à regra "o front nunca escreve direto no Supabase": o
// Render (free) costuma estar dormindo quando alguém chega pelo anúncio, e quem
// fecha o navegador do Instagram em segundos teria a exibição perdida — a taxa
// de aceite sairia inflada. A função só soma contadores de valores fixos (ver
// supabase/consent_stats.sql) e o front não lê a tabela nem a view.
import { channelFromUserAgent } from './trafficOrigin.js';

const META_SOURCES = new Set(['meta', 'facebook', 'fb', 'instagram', 'ig', 'insta']);
const GOOGLE_SOURCES = new Set(['google', 'gads', 'adwords']);

// Origem pelo utm_source da chegada (só ele, sem referrer nem origem guardada).
export function classifyConsentOrigin(search = '') {
  let source = '';

  try {
    source = String(new URLSearchParams(search).get('utm_source') || '').trim().toLowerCase();
  } catch {
    source = '';
  }

  if (!source) {
    return 'organico';
  }

  if (META_SOURCES.has(source)) {
    return 'meta';
  }

  if (GOOGLE_SOURCES.has(source)) {
    return 'google';
  }

  return 'outro';
}

export function classifyConsentDevice(userAgent = '') {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(String(userAgent)) ? 'celular' : 'desktop';
}

export function classifyInAppBrowser(userAgent = '') {
  return channelFromUserAgent(userAgent) || 'nenhum';
}

export function classifyConsentContext({ search = '', userAgent = '' } = {}) {
  return {
    origem: classifyConsentOrigin(search),
    dispositivo: classifyConsentDevice(userAgent),
    navegador_interno: classifyInAppBrowser(userAgent),
  };
}

// No máximo 1 "mostrado" por carga de página (a trava vive só na memória) e a
// decisão só conta se a exibição daquela carga foi contada — assim aceite e
// recusa sempre têm a exibição correspondente no mesmo dia e na mesma linha.
export function createConsentStatsCounter({ send }) {
  let context = null;
  let decided = false;

  return {
    shown(nextContext) {
      if (context || !nextContext) {
        return false;
      }

      context = nextContext;
      send('mostrado', context);
      return true;
    },
    decision(status) {
      if (!context || decided || (status !== 'accepted' && status !== 'rejected')) {
        return false;
      }

      decided = true;
      send(status === 'accepted' ? 'aceitou' : 'recusou', context);
      return true;
    },
  };
}

// Envio sem esperar resposta: contagem nunca atrasa nem quebra o banner.
export function sendConsentStat(client, evento, context) {
  if (!client || typeof client.rpc !== 'function' || !context) {
    return;
  }

  try {
    Promise.resolve(
      client.rpc('consent_stats_increment', {
        p_evento: evento,
        p_origem: context.origem,
        p_dispositivo: context.dispositivo,
        p_navegador_interno: context.navegador_interno,
      }),
    ).catch(() => null);
  } catch {
    // Sem rede ou sem cliente: a exibição só deixa de ser contada.
  }
}
