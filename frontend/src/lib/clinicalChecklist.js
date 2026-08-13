// Motor de checklist condicional por eixo (idade, idade gestacional, etc.).
// Só é ativado quando a ferramenta declara `engineConfig.axisFieldId`; qualquer
// outra ferramenta clínica continua no cálculo genérico de soma/fórmula.

const DEFAULT_CHECKLIST_LABELS = {
  present: 'Presentes',
  alert: 'Ausentes (marco de alerta)',
  watch: 'Ausentes (acompanhar)',
  notApplicable: 'Não se aplica',
  upcoming: 'Próximos marcos a observar',
};

const CHECKLIST_GROUP_COLORS = {
  present: 'green',
  alert: 'red',
  watch: 'yellow',
  notApplicable: 'gray',
};

const CHECKLIST_GROUP_ORDER = ['alert', 'watch', 'present', 'notApplicable'];

function getFields(tool) {
  return Array.isArray(tool?.fields) ? tool.fields : [];
}

function toFiniteNumber(value) {
  // Number(null) e Number('') são 0 — aqui ausência precisa continuar ausência,
  // senão um limiar não configurado viraria o limiar zero.
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getChecklistAxisField(tool) {
  const axisFieldId = tool?.engineConfig?.axisFieldId;

  if (!axisFieldId) {
    return null;
  }

  return getFields(tool).find((field) => field.id === axisFieldId) || null;
}

export function isChecklistTool(tool) {
  return Boolean(getChecklistAxisField(tool));
}

export function getChecklistLabels(tool) {
  const configured = tool?.engineConfig?.checklistLabels || {};

  return Object.keys(DEFAULT_CHECKLIST_LABELS).reduce((accumulator, key) => ({
    ...accumulator,
    [key]: configured[key] || DEFAULT_CHECKLIST_LABELS[key],
  }), {});
}

export function getChecklistGroupColor(group) {
  return CHECKLIST_GROUP_COLORS[group] || 'gray';
}

export function formatAxisAmount(value, unit) {
  const number = toFiniteNumber(value);

  if (number == null) {
    return '';
  }

  const text = Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));

  return unit ? `${text} ${unit}` : text;
}

function getSelectedOption(field, value) {
  if (value == null || value === '') {
    return null;
  }

  return (field.options || []).find((option) => option.value === value) || null;
}

export function resolveChecklistAxisValue(axisField, value) {
  if (!axisField) {
    return null;
  }

  if (axisField.inputType === 'number') {
    if (value == null || String(value).trim() === '') {
      return null;
    }

    return toFiniteNumber(value);
  }

  const option = getSelectedOption(axisField, value);

  return option ? toFiniteNumber(option.numericValue) : null;
}

function getFieldThresholds(field) {
  const applicableFrom = toFiniteNumber(field.applicableFrom);
  const alertFrom = toFiniteNumber(field.alertFrom);

  return {
    applicableFrom,
    applicableUntil: toFiniteNumber(field.applicableUntil),
    // Sem limiar de alerta próprio, o item alerta assim que passa a ser esperado.
    alertFrom: alertFrom == null ? applicableFrom : alertFrom,
  };
}

function resolveItemVisibility(thresholds, axisValue, previewWindow) {
  if (thresholds.applicableFrom == null && thresholds.applicableUntil == null) {
    return 'active';
  }

  // Enquanto a idade não for informada, nenhum marco é exibido: o profissional
  // marca a idade primeiro e só então vê os itens que fazem sentido avaliar.
  if (axisValue == null) {
    return 'hidden';
  }

  // Item já superado pela faixa atual: sai do formulário para não poluir a
  // consulta com marcos avaliados em consultas anteriores.
  if (thresholds.applicableUntil != null && axisValue > thresholds.applicableUntil) {
    return 'hidden';
  }

  if (thresholds.applicableFrom == null || axisValue >= thresholds.applicableFrom) {
    return 'active';
  }

  if (previewWindow > 0 && axisValue >= thresholds.applicableFrom - previewWindow) {
    return 'upcoming';
  }

  return 'hidden';
}

function resolveItemGroup(outcome, thresholds, axisValue) {
  if (outcome === 'not_applicable') {
    return 'notApplicable';
  }

  if (outcome !== 'absent') {
    return 'present';
  }

  if (thresholds.alertFrom == null || axisValue == null || axisValue >= thresholds.alertFrom) {
    return 'alert';
  }

  return 'watch';
}

export function evaluateChecklist(tool, values = {}) {
  const axisField = getChecklistAxisField(tool);

  if (!axisField) {
    return null;
  }

  const axisValue = resolveChecklistAxisValue(axisField, values[axisField.id]);
  const axisOption = getSelectedOption(axisField, values[axisField.id]);
  const axisUnit = tool?.engineConfig?.axisUnit || '';
  const axisDisplay = axisOption?.label || formatAxisAmount(axisValue, axisUnit);
  const previewWindow = Math.max(toFiniteNumber(tool?.engineConfig?.previewWindow) || 0, 0);

  const activeFields = [axisField];
  const upcomingItems = [];
  const missingFields = [];
  const groups = {
    alert: [],
    watch: [],
    present: [],
    notApplicable: [],
  };

  getFields(tool)
    .filter((field) => field.id !== axisField.id)
    .forEach((field) => {
      const thresholds = getFieldThresholds(field);
      const visibility = resolveItemVisibility(thresholds, axisValue, previewWindow);

      if (visibility === 'hidden') {
        return;
      }

      const expectedText = field.expectedLabel || formatAxisAmount(thresholds.applicableFrom, axisUnit);

      if (visibility === 'upcoming') {
        upcomingItems.push({
          id: field.id,
          label: field.label,
          applicableFrom: thresholds.applicableFrom,
          expectedText,
        });
        return;
      }

      activeFields.push(field);

      const option = getSelectedOption(field, values[field.id]);

      if (!option) {
        if (field.required) {
          missingFields.push(field);
        }

        return;
      }

      const group = resolveItemGroup(option.outcome, thresholds, axisValue);

      groups[group].push({
        id: field.id,
        label: field.label,
        optionLabel: option.label,
        optionHelperText: option.helperText || '',
        expectedText,
      });
    });

  const answeredCount = CHECKLIST_GROUP_ORDER.reduce((total, group) => total + groups[group].length, 0);

  return {
    mode: 'checklist',
    axisField,
    axisValue,
    axisDisplay,
    axisUnit,
    labels: getChecklistLabels(tool),
    activeFields,
    upcomingItems,
    groups,
    groupOrder: CHECKLIST_GROUP_ORDER,
    missingFields,
    alertCount: groups.alert.length,
    answeredCount,
    // O resultado só é classificado com a idade informada e todos os itens
    // aplicáveis respondidos — parcial não vira "compatível com a idade".
    ready: axisValue != null && missingFields.length === 0 && answeredCount > 0,
  };
}

export function buildChecklistCopyText(tool, evaluation, range) {
  if (!evaluation?.ready) {
    return '';
  }

  const title = tool?.title || 'Ferramenta clínica';
  const header = evaluation.axisDisplay
    ? `${title} (${evaluation.axisField.label}: ${evaluation.axisDisplay})`
    : title;
  const lines = [header];

  evaluation.groupOrder.forEach((group) => {
    const items = evaluation.groups[group];

    if (!items.length) {
      return;
    }

    lines.push(`${evaluation.labels[group]}: ${items.map((item) => item.label).join('; ')}`);
  });

  if (evaluation.upcomingItems.length > 0) {
    const upcoming = evaluation.upcomingItems
      .map((item) => (item.expectedText ? `${item.label} (esperado: ${item.expectedText})` : item.label))
      .join('; ');
    lines.push(`${evaluation.labels.upcoming}: ${upcoming}`);
  }

  if (range?.classification) {
    lines.push(`Classificação: ${range.classification}`);
  }

  if (range?.orientation) {
    lines.push(`Orientação: ${range.orientation}`);
  }

  if (tool?.sourceReference) {
    lines.push(`Fonte: ${tool.sourceReference}`);
  }

  return lines.join('\n');
}
