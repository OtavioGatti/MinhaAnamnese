// Celular do cadastro: máscara do campo e a mesma validação do servidor
// (espelho de backend/utils/phone.js — o teste phone.test.js roda os mesmos
// casos nos dois).

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function normalizeBrazilianMobile(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  let digits = String(value).replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  if (digits.length !== 11) {
    return null;
  }

  const ddd = Number(digits.slice(0, 2));
  const subscriber = digits.slice(2);

  if (!VALID_DDDS.has(ddd) || subscriber[0] !== '9') {
    return null;
  }

  if (/^(\d)\1+$/.test(subscriber.slice(1))) {
    return null;
  }

  return digits;
}

// Máscara progressiva enquanto a pessoa digita: "1198" → "(11) 98",
// "11987654321" → "(11) 98765-4321". Um +55 colado é descartado.
export function formatBrazilianMobileInput(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 11);

  if (!digits) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const PHONE_INVALID_MESSAGE = 'Informe um celular válido com DDD, por exemplo (11) 98765-4321.';
