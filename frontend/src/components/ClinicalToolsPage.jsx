import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';
import CatalogFilterPanel, { getCatalogFilterValues } from './CatalogFilterPanel';
import ExamsSection from './ExamsSection';
import ManeuversSection from './ManeuversSection';
import {
  buildChecklistCopyText,
  evaluateChecklist,
  formatChecklistItemLabel,
  getChecklistGroupColor,
  groupItemsByDomain,
  isChecklistTool,
} from '../lib/clinicalChecklist';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;

const TOOL_TYPE_LABELS = {
  sum_points: 'Score por pontos',
  math_formula: 'Calculadora',
  conditional_logic: 'Lógica condicional',
};

const ALLOWED_FORMULA_FUNCTIONS = {
  abs: Math.abs,
  ceil: Math.ceil,
  exp: Math.exp,
  floor: Math.floor,
  ifelse: (condition, whenTrue, whenFalse) => (condition ? whenTrue : whenFalse),
  ln: Math.log,
  log: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sqrt: Math.sqrt,
};

function normalizeDisplayText(value) {
  return String(value || '').trim();
}

function getToolTitle(tool) {
  return tool?.title || 'Ferramenta clínica';
}

function getToolMeta(tool, { includeCategory = true } = {}) {
  return [
    includeCategory ? tool?.category : '',
    tool?.subcategory,
    TOOL_TYPE_LABELS[tool?.toolType] || 'Ferramenta',
  ].filter(Boolean);
}

function groupToolsByCategory(tools) {
  const groups = new Map();

  tools.forEach((tool) => {
    const key = tool.category || 'Outras';

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(tool);
  });

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

function getOptionByValue(field, value) {
  return field?.options?.find((option) => option.value === value) || null;
}

function getOptionNumericValue(option) {
  const number = Number(option?.numericValue);
  return Number.isFinite(number) ? number : 0;
}

function getFieldNumericValue(field, value) {
  if (field?.inputType === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  if (field?.inputType === 'checkbox') {
    const selectedValues = Array.isArray(value) ? value : [];

    return selectedValues.reduce((total, selectedValue) => {
      return total + getOptionNumericValue(getOptionByValue(field, selectedValue));
    }, 0);
  }

  return getOptionNumericValue(getOptionByValue(field, value));
}

function getFieldSelectedItems(field, value) {
  if (field?.inputType === 'checkbox') {
    const selectedValues = Array.isArray(value) ? value : [];

    return selectedValues
      .map((selectedValue) => getOptionByValue(field, selectedValue))
      .filter(Boolean)
      .map((option) => ({
        fieldLabel: field.label,
        optionLabel: option.label,
        numericValue: getOptionNumericValue(option),
      }));
  }

  if (field?.inputType === 'number') {
    const numericValue = getFieldNumericValue(field, value);
    const labelSuffix = field.unit ? ` ${field.unit}` : '';

    return [{
      fieldLabel: field.label,
      optionLabel: `${formatResultValue(numericValue)}${labelSuffix}`,
      numericValue,
    }];
  }

  const option = getOptionByValue(field, value);

  if (!option) {
    return [];
  }

  return [{
    fieldLabel: field.label,
    optionLabel: option.label,
    numericValue: getOptionNumericValue(option),
  }];
}

function isFieldMissing(field, value) {
  if (!field?.required) {
    return false;
  }

  if (field.inputType === 'checkbox') {
    return !Array.isArray(value) || value.length === 0;
  }

  return value == null || String(value).trim() === '';
}

function createInitialValues(fields) {
  return (fields || []).reduce((accumulator, field) => ({
    ...accumulator,
    [field.id]: field.inputType === 'checkbox' ? [] : '',
  }), {});
}

function formatResultValue(value, precision = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '';
  }

  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toFixed(precision).replace(/\.?0+$/, '');
}

function evaluateSafeFormula(formula, variables) {
  const text = normalizeDisplayText(formula);

  if (!text || !/^[0-9+\-*/().,\s_a-zA-Z<>!=]+$/.test(text)) {
    return null;
  }

  if (/(^|[^<>=!])=([^=]|$)/.test(text) || /={3,}|!={2,}/.test(text)) {
    return null;
  }

  let hasUnknownToken = false;
  const expression = text.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_FORMULA_FUNCTIONS, token)) {
      return token;
    }

    if (!Object.prototype.hasOwnProperty.call(variables, token)) {
      hasUnknownToken = true;
      return '0';
    }

    const value = Number(variables[token]);
    return Number.isFinite(value) ? `(${value})` : '0';
  });

  if (hasUnknownToken || !/^[0-9+\-*/().,\s_a-zA-Z<>!=]+$/.test(expression)) {
    return null;
  }

  try {
    const functionNames = Object.keys(ALLOWED_FORMULA_FUNCTIONS);
    const functionValues = functionNames.map((name) => ALLOWED_FORMULA_FUNCTIONS[name]);
    const result = Function(...functionNames, `"use strict"; return (${expression});`)(...functionValues);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function findResultRange(result, resultRanges) {
  if (!Number.isFinite(result)) {
    return null;
  }

  return (resultRanges || []).find((range) => {
    const min = range.min == null ? -Infinity : Number(range.min);
    const max = range.max == null ? Infinity : Number(range.max);

    return result >= min && result <= max;
  }) || null;
}

function getFieldById(fields, fieldId) {
  return fields.find((field) => field.id === fieldId) || null;
}

function getOutputRequiredFields(output, fields) {
  const configuredFields = Array.isArray(output.requiredFields) ? output.requiredFields : [];

  return configuredFields
    .map((fieldId) => getFieldById(fields, fieldId))
    .filter(Boolean);
}

function calculateFormulaOutput(output, variables, fields, values, fallbackRanges = []) {
  const requiredFields = getOutputRequiredFields(output, fields);
  const missingFields = requiredFields.filter((field) => isFieldMissing(field, values[field.id]));

  if (missingFields.length > 0) {
    return {
      ...output,
      value: null,
      range: null,
      ready: false,
      missingFields,
    };
  }

  const value = evaluateSafeFormula(output.formula, variables);
  const resultRanges = Array.isArray(output.resultRanges) && output.resultRanges.length > 0
    ? output.resultRanges
    : fallbackRanges;

  return {
    ...output,
    value,
    range: findResultRange(value, resultRanges),
    ready: value != null,
    missingFields: [],
  };
}

function calculateChecklistToolResult(tool, values) {
  const evaluation = evaluateChecklist(tool, values);

  return {
    ...evaluation,
    value: evaluation.alertCount,
    range: evaluation.ready ? findResultRange(evaluation.alertCount, tool.resultRanges) : null,
    selectedItems: [],
  };
}

function calculateToolResult(tool, values) {
  if (isChecklistTool(tool)) {
    return calculateChecklistToolResult(tool, values);
  }

  const fields = tool?.fields || [];
  const missingFields = fields.filter((field) => isFieldMissing(field, values[field.id]));
  const configuredOutputs = Array.isArray(tool?.engineConfig?.outputs) ? tool.engineConfig.outputs : [];

  if (missingFields.length > 0 && !(tool.toolType === 'math_formula' && configuredOutputs.length > 0)) {
    return {
      ready: false,
      missingFields,
      value: null,
      range: null,
      selectedItems: [],
    };
  }

  if (tool.toolType === 'math_formula') {
    const variables = fields.reduce((accumulator, field) => ({
      ...accumulator,
      [field.id]: getFieldNumericValue(field, values[field.id]),
    }), {});
    const outputFallbackRanges = configuredOutputs.length === 1 ? tool.resultRanges : [];
    const outputs = configuredOutputs.map((output) => {
      return calculateFormulaOutput(output, variables, fields, values, outputFallbackRanges);
    });
    const primaryOutput = outputs[0] || null;
    const value = primaryOutput
      ? primaryOutput.value
      : evaluateSafeFormula(tool.engineConfig?.formula, variables);
    const ready = outputs.length > 0
      ? outputs.some((output) => output.ready)
      : value != null;

    return {
      ready,
      missingFields: [],
      value,
      range: primaryOutput?.range || findResultRange(value, tool.resultRanges),
      outputs,
      selectedItems: fields.flatMap((field) => getFieldSelectedItems(field, values[field.id])),
    };
  }

  const value = fields.reduce((total, field) => {
    return total + getFieldNumericValue(field, values[field.id]);
  }, 0);
  const selectedItems = fields.flatMap((field) => getFieldSelectedItems(field, values[field.id]));

  return {
    ready: true,
    missingFields: [],
    value,
    range: findResultRange(value, tool.resultRanges),
    selectedItems,
  };
}

function buildCopyText(tool, result) {
  if (!tool) {
    return '';
  }

  if (result?.mode === 'checklist') {
    return buildChecklistCopyText(tool, result, result.range);
  }

  if (Array.isArray(result.outputs) && result.outputs.length > 0) {
    const lines = [getToolTitle(tool)];
    const readyOutputs = result.outputs.filter((output) => output.ready);

    if (readyOutputs.length === 0) {
      return '';
    }

    readyOutputs.forEach((output) => {
      const precision = output.precision ?? tool.engineConfig?.precision;
      const unit = output.unit ? ` ${output.unit}` : '';
      lines.push(`${output.label || output.resultLabel || 'Resultado'}: ${formatResultValue(output.value, precision)}${unit}`);

      if (output.range?.classification) {
        lines.push(`Classificação: ${output.range.classification}`);
      }

      if (output.range?.orientation) {
        lines.push(`Orientação: ${output.range.orientation}`);
      }
    });

    return lines.join('\n');
  }

  if (!result?.ready) {
    return '';
  }

  const valueText = formatResultValue(result.value, tool.engineConfig?.precision);
  const unit = tool.engineConfig?.unit ? ` ${tool.engineConfig.unit}` : '';
  const lines = [
    `${getToolTitle(tool)}: ${valueText}${unit}`,
  ];

  if (result.range?.classification) {
    lines.push(`Classificação: ${result.range.classification}`);
  }

  if (result.range?.orientation) {
    lines.push(`Orientação: ${result.range.orientation}`);
  }

  return lines.join('\n');
}

async function copyTextToClipboard(text) {
  if (!text) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function ToolResultItem({ tool, selectedSlug, setSelectedSlug, includeCategory }) {
  const meta = getToolMeta(tool, { includeCategory }).join(' · ');

  return (
    <button
      type="button"
      className={`protocol-result-item ${tool.slug === selectedSlug ? 'active' : ''}`}
      onClick={() => setSelectedSlug(tool.slug)}
    >
      <strong>{getToolTitle(tool)}</strong>
      <span>{meta || 'Ferramenta clínica'}</span>
    </button>
  );
}

function ClinicalToolSidebar({
  query,
  setQuery,
  category,
  setCategory,
  onClearCategory,
  subcategory,
  setSubcategory,
  categories,
  subcategories,
  tools,
  selectedSlug,
  setSelectedSlug,
  loadingTools,
  error,
}) {
  // Sem busca nem filtro, a lista corrida de dezenas de ferramentas não ajuda
  // a achar nada — aí vale quebrar por categoria.
  const grouped = !query.trim() && !category;
  const groups = grouped ? groupToolsByCategory(tools) : [];

  return (
    <aside className="protocol-sidebar clinical-tool-sidebar">
      <label className="protocol-search-label" htmlFor="clinical-tool-search">
        Buscar ferramenta
      </label>
      <input
        id="clinical-tool-search"
        className="protocol-search-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedSlug('');
        }}
        placeholder="Ex: HEART, IMC, M-CHAT"
      />

      <CatalogFilterPanel
        groups={[
          {
            key: 'category',
            label: 'Especialidade',
            values: categories,
            selected: category,
            onSelect: setCategory,
            onClear: onClearCategory,
          },
          {
            key: 'subcategory',
            label: 'Tipo',
            values: subcategories,
            selected: subcategory,
            onSelect: setSubcategory,
          },
        ]}
      />

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loadingTools ? (
          <div className="prescription-empty">Buscando ferramentas...</div>
        ) : tools.length === 0 ? (
          <div className="prescription-empty">Nenhuma ferramenta encontrada.</div>
        ) : grouped ? (
          groups.map(([groupName, groupTools]) => (
            <div key={groupName} className="clinical-tool-result-group">
              <h3>{groupName}</h3>
              {groupTools.map((tool) => (
                <ToolResultItem
                  key={tool.slug}
                  tool={tool}
                  selectedSlug={selectedSlug}
                  setSelectedSlug={setSelectedSlug}
                  includeCategory={false}
                />
              ))}
            </div>
          ))
        ) : (
          tools.map((tool) => (
            <ToolResultItem
              key={tool.slug}
              tool={tool}
              selectedSlug={selectedSlug}
              setSelectedSlug={setSelectedSlug}
              includeCategory={!category}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SelectField({ field, value, onChange }) {
  return (
    <label className="clinical-tool-field">
      <span>{field.label}</span>
      {field.helperText ? <small>{field.helperText}</small> : null}
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione...</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ field, value, onChange }) {
  return (
    <label className="clinical-tool-field">
      <span>{field.label}</span>
      {field.helperText ? <small>{field.helperText}</small> : null}
      <div className="clinical-tool-number-row">
        <input
          type="number"
          value={value || ''}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? 'any'}
          placeholder={field.placeholder || ''}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.unit ? <em>{field.unit}</em> : null}
      </div>
    </label>
  );
}

function OptionGroupField({ field, value, onChange, showScore = true }) {
  const selectedValues = field.inputType === 'checkbox' && Array.isArray(value) ? value : [];

  function handleCheckboxChange(optionValue) {
    const nextValues = selectedValues.includes(optionValue)
      ? selectedValues.filter((item) => item !== optionValue)
      : [...selectedValues, optionValue];

    onChange(nextValues);
  }

  return (
    <fieldset className="clinical-tool-field clinical-tool-option-group">
      <legend>{field.label}</legend>
      {field.helperText ? <small>{field.helperText}</small> : null}

      <div className="clinical-tool-option-list">
        {field.options.map((option) => {
          const checked = field.inputType === 'checkbox'
            ? selectedValues.includes(option.value)
            : value === option.value;

          return (
            <label
              key={option.value}
              className={`clinical-tool-option ${checked ? 'selected' : ''} ${showScore ? '' : 'no-score'}`}
            >
              <input
                type={field.inputType === 'checkbox' ? 'checkbox' : 'radio'}
                name={field.id}
                checked={checked}
                onChange={() => {
                  if (field.inputType === 'checkbox') {
                    handleCheckboxChange(option.value);
                  } else {
                    onChange(option.value);
                  }
                }}
              />
              <span>
                <strong>{option.label}</strong>
                {option.helperText ? <small>{option.helperText}</small> : null}
              </span>
              {showScore ? <em>{formatResultValue(option.numericValue, 1)}</em> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ClinicalToolField({ field, value, onChange, showScore = true }) {
  if (field.inputType === 'number') {
    return <NumberField field={field} value={value} onChange={onChange} />;
  }

  if (field.inputType === 'select') {
    return <SelectField field={field} value={value} onChange={onChange} />;
  }

  return <OptionGroupField field={field} value={value} onChange={onChange} showScore={showScore} />;
}

function ChecklistResult({ tool, result, copied, onCopy }) {
  const resultLabel = tool?.engineConfig?.resultLabel || 'Resultado';

  if (!result.ready) {
    const waitingForAxis = result.axisValue == null;

    return (
      <section className="clinical-tool-result-card neutral">
        <span>{resultLabel}</span>
        <h3>{waitingForAxis ? `Informe ${result.axisField.label.toLowerCase()}` : 'Complete a avaliação'}</h3>
        {waitingForAxis ? (
          <p>Os itens avaliados são liberados conforme o valor informado — nada fora da faixa entra no resultado.</p>
        ) : (
          <p>
            {result.missingFields.length > 0
              ? `Faltam: ${result.missingFields.map((field) => field.label).join(', ')}.`
              : 'Nenhum item aplicável para o valor informado.'}
          </p>
        )}
      </section>
    );
  }

  const scoreLabel = tool?.engineConfig?.scoreLabel || 'itens';
  const countText = `${result.alertCount} ${scoreLabel}`;
  const color = result.range?.alertColor || (result.alertCount > 0 ? 'yellow' : 'green');

  return (
    <div className="clinical-tool-result-stack">
      <section className={`clinical-tool-result-card ${color}`}>
        <div className="clinical-tool-result-header">
          <div>
            <span>{resultLabel}</span>
            <h3 className="clinical-tool-result-classification">
              {result.range?.classification || countText}
            </h3>
          </div>
          <strong>{countText}</strong>
        </div>

        {result.range?.orientation ? <p>{result.range.orientation}</p> : null}
      </section>

      <button type="button" className="btn btn-secundario" onClick={onCopy}>
        {copied ? 'Copiado' : 'Copiar para o prontuário'}
      </button>
    </div>
  );
}

function ChecklistBreakdown({ result }) {
  const filledGroups = result.groupOrder.filter((group) => result.groups[group].length > 0);

  if (filledGroups.length === 0) {
    return null;
  }

  return (
    <section className="clinical-tool-breakdown clinical-tool-checklist-breakdown">
      <h3>Resumo da avaliação</h3>

      {filledGroups.map((group) => (
        <div key={group} className={`clinical-tool-checklist-group ${getChecklistGroupColor(group)}`}>
          <h4>{result.labels[group]} ({result.groups[group].length})</h4>
          {groupItemsByDomain(result.groups[group]).map(({ domain, items }) => (
            <div key={domain || 'sem_dominio'} className="clinical-tool-checklist-domain">
              {domain ? <h5>{domain}</h5> : null}
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <span>{formatChecklistItemLabel(item)}</span>
                    {item.expectedText ? <em>esperado: {item.expectedText}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function ChecklistUpcoming({ result }) {
  if (result.upcomingItems.length === 0) {
    return null;
  }

  return (
    <section className="clinical-tool-breakdown clinical-tool-checklist-upcoming">
      <h3>{result.labels.upcoming}</h3>
      <p>Ainda não esperados nesta avaliação — observar na próxima consulta.</p>
      <ul>
        {result.upcomingItems.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            {item.expectedText ? <em>esperado: {item.expectedText}</em> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClinicalToolResult({ tool, result, copied, onCopy }) {
  const hasOutputs = Array.isArray(result?.outputs) && result.outputs.length > 0;

  if (!result?.ready && !hasOutputs) {
    return (
      <section className="clinical-tool-result-card neutral">
        <span>Resultado</span>
        <h3>Preencha os campos obrigatórios</h3>
        {result?.missingFields?.length ? (
          <p>Faltam: {result.missingFields.map((field) => field.label).join(', ')}.</p>
        ) : null}
      </section>
    );
  }

  function renderResultCard(item) {
    const resultLabel = item.resultLabel || item.label || tool?.engineConfig?.resultLabel || 'Resultado';

    if (item.ready === false) {
      return (
        <section key={item.id || resultLabel} className="clinical-tool-result-card neutral">
          <div className="clinical-tool-result-header">
            <div>
              <span>{resultLabel}</span>
              <h3>Preencha os campos</h3>
            </div>
          </div>
          {item.missingFields?.length ? (
            <p>Faltam: {item.missingFields.map((field) => field.label).join(', ')}.</p>
          ) : null}
        </section>
      );
    }

    const precision = item.precision ?? tool?.engineConfig?.precision ?? 1;
    const unit = item.unit ? ` ${item.unit}` : (tool?.engineConfig?.unit ? ` ${tool.engineConfig.unit}` : '');
    const scoreLabel = tool?.engineConfig?.scoreLabel || 'pontos';
    const valueText = `${formatResultValue(item.value, precision)}${unit || (tool.toolType === 'math_formula' ? '' : ` ${scoreLabel}`)}`;
    const color = item.range?.alertColor || 'gray';

    return (
      <section key={item.id || resultLabel} className={`clinical-tool-result-card ${color}`}>
        <div className="clinical-tool-result-header">
          <div>
            <span>{resultLabel}</span>
            <h3>{valueText}</h3>
          </div>
          {item.range?.classification ? (
            <strong>{item.range.classification}</strong>
          ) : null}
        </div>

        {item.range?.orientation ? <p>{item.range.orientation}</p> : null}
      </section>
    );
  }

  if (hasOutputs) {
    const hasReadyOutput = result.outputs.some((output) => output.ready);

    return (
      <div className="clinical-tool-result-stack">
        {result.outputs.map(renderResultCard)}
        <button type="button" className="btn btn-secundario" onClick={onCopy} disabled={!hasReadyOutput}>
          {copied ? 'Copiado' : 'Copiar resultados'}
        </button>
      </div>
    );
  }

  return (
    <div className="clinical-tool-result-stack">
      {renderResultCard({
        id: 'single_result',
        ready: result.ready,
        value: result.value,
        range: result.range,
      })}
      <button type="button" className="btn btn-secundario" onClick={onCopy}>
        {copied ? 'Copiado' : 'Copiar resultado'}
      </button>
    </div>
  );
}

function ClinicalToolHeader({ tool }) {
  return (
    <header className="protocol-header clinical-tool-detail-header">
      <div className="protocol-header-copy">
        <span className="clinical-drug-eyebrow">Ferramenta clínica</span>
        <h2>{getToolTitle(tool)}</h2>
        {tool?.description ? <p>{tool.description}</p> : null}

        <div className="protocol-header-meta">
          <div className="protocol-meta-chips">
            {getToolMeta(tool).map((item) => (
              <span key={item} className="protocol-meta-chip">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function SafetyNotice() {
  return (
    <div className="protocol-safety-notice">
      <strong>Uso clínico seguro:</strong>
      <span>
        Ferramenta de apoio à decisão. Não substitui julgamento clínico, diretrizes locais,
        protocolos institucionais ou revisão profissional antes de qualquer conduta.
      </span>
    </div>
  );
}

function ClinicalToolsPage({
  user,
  isPro,
  accessState,
  onLogin,
  onRequestUpgrade,
  loadingCheckout,
  checkoutError,
  initialToolSlug = '',
  initialManeuverSlug = '',
  initialExamSlug = '',
}) {
  // Link direto abre a aba do item; sem isso, cai nas calculadoras.
  const [pageTab, setPageTab] = useState(() => {
    if (initialManeuverSlug) return 'manobras';
    if (initialExamSlug) return 'exames';
    return 'calculadoras';
  });
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [tools, setTools] = useState([]);
  // Catálogo completo (primeira carga, sem busca nem filtro): alimenta os chips
  // para que eles não sumam conforme a busca estreita o resultado.
  const [catalog, setCatalog] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(initialToolSlug);
  const [selectedTool, setSelectedTool] = useState(null);
  const [values, setValues] = useState({});
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id || !isPro) {
      setTools([]);
      setSelectedSlug('');
      setSelectedTool(null);
      setLoadingTools(false);
      setLoadingDetail(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingTools(true);
      setError('');

      const params = new URLSearchParams({
        q: query.trim(),
        limit: '80',
      });

      if (category) {
        params.set('category', category);
      }

      const response = await api.get(`/clinical-tools?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setTools(response.data);

        if (!query.trim() && !category) {
          setCatalog(response.data);
        }

        if (!selectedSlug && response.data[0]?.slug) {
          setSelectedSlug(response.data[0].slug);
        }
      } else {
        setTools([]);
        setError(response.error || 'Não foi possível buscar as ferramentas clínicas.');
      }

      setLoadingTools(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [category, isPro, query, selectedSlug, user?.id]);

  useEffect(() => {
    if (!user?.id || !isPro || !selectedSlug) {
      setSelectedTool(null);
      setValues({});
      return undefined;
    }

    let ignore = false;

    async function loadToolDetail() {
      setLoadingDetail(true);
      setError('');
      setCopied(false);
      const response = await api.get(`/clinical-tools?slug=${encodeURIComponent(selectedSlug)}`);

      if (ignore) {
        return;
      }

      if (response.success && response.data) {
        setSelectedTool(response.data);
        setValues(createInitialValues(response.data.fields));
      } else {
        setSelectedTool(null);
        setValues({});
        setError(response.error || 'Não foi possível abrir esta ferramenta.');
      }

      setLoadingDetail(false);
    }

    loadToolDetail();

    return () => {
      ignore = true;
    };
  }, [isPro, selectedSlug, user?.id]);

  // Abrir a ferramenta pedida por um link de modelo, inclusive quando a página
  // já estava montada em outra ferramenta.
  useEffect(() => {
    if (!initialToolSlug) {
      return;
    }

    setQuery(DEFAULT_QUERY);
    setCategory('');
    setSubcategory('');
    setSelectedSlug(initialToolSlug);
  }, [initialToolSlug]);

  const categories = useMemo(() => getCatalogFilterValues(catalog, 'category'), [catalog]);

  const subcategories = useMemo(() => {
    const scoped = category ? catalog.filter((tool) => tool.category === category) : catalog;
    return getCatalogFilterValues(scoped, 'subcategory');
  }, [catalog, category]);

  // Subcategoria refina no cliente: é um recorte estreito dentro de um resultado
  // que o servidor já filtrou por busca e categoria.
  const visibleTools = useMemo(() => {
    if (!subcategory) {
      return tools;
    }

    return tools.filter((tool) => tool.subcategory === subcategory);
  }, [subcategory, tools]);

  useEffect(() => {
    if (visibleTools.length === 0) {
      return;
    }

    if (visibleTools.some((tool) => tool.slug === selectedSlug)) {
      return;
    }

    setSelectedSlug(visibleTools[0].slug);
  }, [selectedSlug, visibleTools]);

  const result = useMemo(() => {
    if (!selectedTool) {
      return null;
    }

    return calculateToolResult(selectedTool, values);
  }, [selectedTool, values]);

  const isChecklist = result?.mode === 'checklist';

  const headerCopy = useMemo(() => {
    if (accessState?.isTrialAccess) {
      return 'Use scores, calculadoras e questionários clínicos durante o teste profissional.';
    }

    return 'Busque scores, calculadoras e questionários clínicos sincronizados do Notion.';
  }, [accessState?.isTrialAccess]);

  function handleCategoryChange(value) {
    setCategory(value);
    setSubcategory('');
    setSelectedSlug('');
  }

  // Remover a especialidade preserva o tipo: sem especialidade a lista de tipos
  // passa a ser a do catálogo inteiro, então o que já estava escolhido continua
  // existindo. Trocar de especialidade continua zerando o tipo
  // (handleCategoryChange), porque aí o tipo antigo pode não existir na nova.
  function handleClearCategory() {
    setCategory('');
    setSelectedSlug('');
  }

  function handleSubcategoryChange(value) {
    setSubcategory(value);
    setSelectedSlug('');
  }

  function updateFieldValue(fieldId, value) {
    setCopied(false);
    setValues((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  async function handleCopyResult() {
    await copyTextToClipboard(buildCopyText(selectedTool, result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!user?.id) {
    return (
      <main className="prescription-guide-page clinical-tool-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Avaliação clínica</span>
          <h1>Entre para usar a avaliação clínica</h1>
          <p>Este recurso fica protegido para profissionais com conta ativa.</p>
          <button type="button" className="btn btn-primario prescription-access-action" onClick={onLogin}>
            Entrar
          </button>
        </section>
      </main>
    );
  }

  if (!isPro) {
    return (
      <main className="prescription-guide-page clinical-tool-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Avaliação clínica</span>
          <h1>Recurso do plano profissional</h1>
          <p>Scores, calculadoras e manobras de exame físico ficam liberados no plano profissional.</p>
          {checkoutError ? <div className="prescription-error">{checkoutError}</div> : null}
          <button
            type="button"
            className="btn btn-primario prescription-access-action"
            onClick={onRequestUpgrade}
            disabled={loadingCheckout}
          >
            {loadingCheckout ? 'Abrindo checkout...' : 'Ativar profissional'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="prescription-guide-page clinical-tool-page">
      <section className="prescription-guide-header clinical-tool-page-header">
        <div>
          <span className="workspace-kicker">Avaliação clínica</span>
          <h1>{pageTab === 'manobras' ? 'Manobras de exame físico' : 'Scores, calculadoras e questionários'}</h1>
          <p>
            {pageTab === 'manobras'
              ? 'Consulte quando fazer, como executar e o que cada achado sugere. As mesmas manobras aparecem junto das hipóteses diagnósticas.'
              : headerCopy}
          </p>
        </div>

        <div className="prescription-section-tabs" role="tablist" aria-label="Seções da avaliação clínica">
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'calculadoras'}
            className={`prescription-section-tab ${pageTab === 'calculadoras' ? 'active' : ''}`}
            onClick={() => setPageTab('calculadoras')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8" />
              <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
            </svg>
            Calculadoras
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'manobras'}
            className={`prescription-section-tab ${pageTab === 'manobras' ? 'active' : ''}`}
            onClick={() => setPageTab('manobras')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
            Manobras
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'exames'}
            className={`prescription-section-tab ${pageTab === 'exames' ? 'active' : ''}`}
            onClick={() => setPageTab('exames')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 2v6.5L4.6 17a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L15 8.5V2" />
              <path d="M8 2h8" />
              <path d="M6.5 14h11" />
            </svg>
            Exames
          </button>
        </div>
      </section>

      {pageTab === 'manobras' ? <ManeuversSection initialSlug={initialManeuverSlug} /> : null}

      {pageTab === 'exames' ? <ExamsSection initialSlug={initialExamSlug} /> : null}

      {pageTab === 'calculadoras' ? (
        <section className="prescription-guide-grid clinical-tool-grid">
          <ClinicalToolSidebar
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={handleCategoryChange}
            onClearCategory={handleClearCategory}
            subcategory={subcategory}
            setSubcategory={handleSubcategoryChange}
            categories={categories}
            subcategories={subcategories}
            tools={visibleTools}
            selectedSlug={selectedSlug}
            setSelectedSlug={setSelectedSlug}
            loadingTools={loadingTools}
            error={error}
          />

          <article className="protocol-detail-panel clinical-tool-detail-panel">
            {loadingDetail ? (
              <div className="prescription-empty">Carregando ferramenta...</div>
            ) : selectedTool ? (
              <>
                <ClinicalToolHeader tool={selectedTool} />
                <SafetyNotice />

                <div className="clinical-tool-workspace">
                  <form className="clinical-tool-form">
                    {(isChecklist ? result.activeFields : selectedTool.fields).map((field) => (
                      <ClinicalToolField
                        key={field.id}
                        field={field}
                        value={values[field.id]}
                        onChange={(value) => updateFieldValue(field.id, value)}
                        showScore={!isChecklist}
                      />
                    ))}
                  </form>

                  <div className="clinical-tool-result-column">
                    {isChecklist ? (
                      <ChecklistResult
                        tool={selectedTool}
                        result={result}
                        copied={copied}
                        onCopy={handleCopyResult}
                      />
                    ) : (
                      <ClinicalToolResult
                        tool={selectedTool}
                        result={result}
                        copied={copied}
                        onCopy={handleCopyResult}
                      />
                    )}

                    {isChecklist ? (
                      <>
                        <ChecklistBreakdown result={result} />
                        <ChecklistUpcoming result={result} />
                      </>
                  ) : null}

                  {result?.selectedItems?.length ? (
                    <section className="clinical-tool-breakdown">
                      <h3>Itens selecionados</h3>
                      <ul>
                        {result.selectedItems.map((item, index) => (
                          <li key={`${item.fieldLabel}-${item.optionLabel}-${index}`}>
                            <span>{item.fieldLabel}: {item.optionLabel}</span>
                            <strong>{formatResultValue(item.numericValue, 1)}</strong>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTool.sourceReference ? (
                    <section className="clinical-tool-source">
                      <h3>Fonte</h3>
                      <p>{selectedTool.sourceReference}</p>
                    </section>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="prescription-empty">Selecione uma ferramenta para começar.</div>
          )}
        </article>
      </section>
      ) : null}
    </main>
  );
}

export default ClinicalToolsPage;
