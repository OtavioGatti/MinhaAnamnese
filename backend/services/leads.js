// Lista de leads para o dono: quem deixou celular no cadastro (ou completou
// depois). Dado pessoal — sai só pela rota admin com o segredo, nunca pelo
// painel de métricas, que é compartilhável e só tem agregados.

const PAGE_SIZE = 1000;
const FUSO = 'America/Sao_Paulo';
const LEAD_COLUMNS = [
  'id',
  'email',
  'display_name',
  'phone',
  'phone_collected_at',
  'whatsapp_opt_in_at',
  'created_at',
  'current_plan',
  'access_source',
  'billing_status',
  'plan_expires_at',
  'last_seen_at',
];

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function formatPhone(digits) {
  const value = String(digits || '');
  return value.length === 11 ? `+55 (${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}` : '';
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

function toLead(row) {
  const phone = String(row?.phone || '');

  return {
    email: row?.email || '',
    nome: row?.display_name || '',
    celular: formatPhone(phone),
    whatsapp: phone ? `https://wa.me/55${phone}` : '',
    aceitaWhatsapp: Boolean(row?.whatsapp_opt_in_at),
    cadastro: formatDate(row?.created_at),
    celularInformadoEm: formatDate(row?.phone_collected_at),
    plano: row?.current_plan || '',
    acesso: row?.access_source || '',
    status: row?.billing_status || '',
    vence: formatDate(row?.plan_expires_at),
    ultimoAcesso: formatDate(row?.last_seen_at),
  };
}

const CSV_HEADER = [
  ['email', 'E-mail'],
  ['nome', 'Nome'],
  ['celular', 'Celular'],
  ['whatsapp', 'Link WhatsApp'],
  ['aceitaWhatsapp', 'Aceita contato no WhatsApp'],
  ['cadastro', 'Cadastro'],
  ['celularInformadoEm', 'Celular informado em'],
  ['plano', 'Plano'],
  ['acesso', 'Acesso'],
  ['status', 'Status'],
  ['vence', 'Vence em'],
  ['ultimoAcesso', 'Último acesso'],
];

function csvCell(value) {
  const text = typeof value === 'boolean' ? (value ? 'sim' : 'não') : String(value ?? '');
  // Ponto e vírgula: separador que o Excel em português abre sem importar.
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// BOM no início para o Excel reconhecer UTF-8 (acentos dos nomes).
function buildLeadsCsv(leads) {
  const lines = [
    CSV_HEADER.map(([, label]) => csvCell(label)).join(';'),
    ...leads.map((lead) => CSV_HEADER.map(([key]) => csvCell(lead[key])).join(';')),
  ];

  return `﻿${lines.join('\r\n')}\r\n`;
}

async function listLeads({ includeWithoutPhone = false } = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('leads storage unavailable');
    error.code = 'CONFIG_UNAVAILABLE';
    throw error;
  }

  const rows = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select: LEAD_COLUMNS.join(','),
      order: 'created_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    if (!includeWithoutPhone) {
      query.set('phone', 'not.is.null');
    }

    const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });

    if (!response.ok) {
      const error = new Error('leads request failed');
      // 400 = coluna inexistente: supabase/profile_phone.sql ainda não aplicado.
      error.code = response.status === 400 ? 'PHONE_COLUMNS_MISSING' : 'LEADS_REQUEST_FAILED';
      throw error;
    }

    const page = await response.json();
    rows.push(...(Array.isArray(page) ? page : []));

    if (!Array.isArray(page) || page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.map(toLead);
}

module.exports = {
  buildLeadsCsv,
  listLeads,
  toLead,
};
