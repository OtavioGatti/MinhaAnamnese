const DAYS_IN_WEEK = 7;
const TOTAL_GESTATION_WEEKS = 40;
const TOTAL_GESTATION_DAYS = TOTAL_GESTATION_WEEKS * DAYS_IN_WEEK;
const MAX_EXPECTED_GESTATION_DAYS = TOTAL_GESTATION_DAYS + 21;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDays(date, amount) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function differenceInDays(startDate, endDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function buildError(error) {
  return {
    success: false,
    error,
    data: null,
  };
}

function buildSuccess(data) {
  return {
    success: true,
    error: '',
    data,
  };
}

function formatGestationalAge(totalDays) {
  const weeks = Math.floor(totalDays / DAYS_IN_WEEK);
  const days = totalDays % DAYS_IN_WEEK;

  return {
    weeks,
    days,
    totalDays,
    formatted: `IG: ${weeks} semana${weeks === 1 ? '' : 's'} e ${days} dia${days === 1 ? '' : 's'}`,
  };
}

function validateGestationalAgeRange(totalDays) {
  if (totalDays < 0) {
    return 'A idade gestacional calculada não pode ser negativa.';
  }

  if (totalDays > MAX_EXPECTED_GESTATION_DAYS) {
    return 'A data informada excede a faixa esperada para uma gestação.';
  }

  return '';
}

export function parseDateInput(dateString) {
  if (!dateString || !DATE_INPUT_PATTERN.test(dateString)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateString.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateForInput(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDateBR(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

export function getTodayInputValue() {
  return formatDateForInput(new Date());
}

export function calcularIGPorDUM(dumInput, referenceDateInput = getTodayInputValue()) {
  const dum = parseDateInput(dumInput);
  const referenceDate = parseDateInput(referenceDateInput);

  if (!dum) {
    return buildError('Informe uma DUM válida.');
  }

  if (!referenceDate) {
    return buildError('Informe uma data de referência válida.');
  }

  if (dum > referenceDate) {
    return buildError('A DUM não pode ser maior que a data de referência.');
  }

  const totalDays = differenceInDays(dum, referenceDate);
  const rangeError = validateGestationalAgeRange(totalDays);

  if (rangeError) {
    return buildError(rangeError);
  }

  return buildSuccess(formatGestationalAge(totalDays));
}

export function calcularIGPorUSG({
  usgDateInput,
  usgWeeksInput,
  usgDaysInput = 0,
  referenceDateInput = getTodayInputValue(),
}) {
  const usgDate = parseDateInput(usgDateInput);
  const referenceDate = parseDateInput(referenceDateInput);
  const usgWeeks = Number(usgWeeksInput);
  const usgDays = usgDaysInput === '' ? 0 : Number(usgDaysInput);

  if (!usgDate) {
    return buildError('Informe a data da USG.');
  }

  if (!referenceDate) {
    return buildError('Informe uma data de referência válida.');
  }

  if (usgWeeksInput === '' || Number.isNaN(usgWeeks)) {
    return buildError('Informe a IG da USG em semanas.');
  }

  if (!Number.isInteger(usgWeeks) || usgWeeks < 0 || usgWeeks > TOTAL_GESTATION_WEEKS) {
    return buildError('As semanas da USG devem ser um número inteiro entre 0 e 40.');
  }

  if (Number.isNaN(usgDays) || !Number.isInteger(usgDays) || usgDays < 0 || usgDays >= DAYS_IN_WEEK) {
    return buildError('Os dias da USG devem ser um número inteiro entre 0 e 6.');
  }

  if (usgDate > referenceDate) {
    return buildError('A data da USG não pode ser maior que a data de referência.');
  }

  const initialDays = (usgWeeks * DAYS_IN_WEEK) + usgDays;
  const elapsedDays = differenceInDays(usgDate, referenceDate);
  const totalDays = initialDays + elapsedDays;
  const rangeError = validateGestationalAgeRange(totalDays);

  if (rangeError) {
    return buildError(rangeError);
  }

  return buildSuccess(formatGestationalAge(totalDays));
}

export function calcularDPP(dumInput) {
  const dum = parseDateInput(dumInput);

  if (!dum) {
    return buildError('Informe uma DUM válida.');
  }

  const dueDate = addDays(dum, TOTAL_GESTATION_DAYS);

  return buildSuccess({
    date: dueDate,
    formatted: formatDateBR(dueDate),
  });
}

export function calcularDPPporIG(igWeeksInput, currentDateInput = getTodayInputValue()) {
  const currentDate = parseDateInput(currentDateInput);
  const igWeeks = Number(igWeeksInput);

  if (!currentDate) {
    return buildError('Informe uma data atual válida.');
  }

  if (igWeeksInput === '' || Number.isNaN(igWeeks)) {
    return buildError('Informe a idade gestacional em semanas.');
  }

  if (!Number.isInteger(igWeeks) || igWeeks < 0) {
    return buildError('A idade gestacional deve ser um número inteiro maior ou igual a zero.');
  }

  if (igWeeks > TOTAL_GESTATION_WEEKS) {
    return buildError('A idade gestacional não pode ser maior que 40 semanas.');
  }

  const remainingDays = (TOTAL_GESTATION_WEEKS - igWeeks) * DAYS_IN_WEEK;
  const dueDate = addDays(currentDate, remainingDays);

  return buildSuccess({
    date: dueDate,
    remainingDays,
    formatted: formatDateBR(dueDate),
  });
}
