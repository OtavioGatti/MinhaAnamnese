import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;

const TOOL_TYPE_LABELS = {
  sum_points: 'Score por pontos',
  math_formula: 'Calculadora',
  conditional_logic: 'Lógica condicional',
};

const RESULT_COLOR_LABELS = {
  green: 'baixo',
  yellow: 'atenção',
  red: 'alto',
  blue: 'informativo',
  gray: 'neutro',
};

const ALLOWED_FORMULA_FUNCTIONS = {
  abs: Math.abs,
  ceil: Math.ceil,
  exp: Math.exp,
  floor: Math.floor,
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

function getToolMeta(tool) {
  return [
    tool?.category,
    tool?.subcategory,
    TOOL_TYPE_LABELS[tool?.toolType] || 'Ferramenta',
  ].filter(Boolean);
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

  if (!text || !/^[0-9+\-*/().,\s_a-zA-Z]+$/.test(text)) {
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

  if (hasUnknownToken || !/^[0-9+\-*/().,\s_a-zA-Z]+$/.test(expression)) {
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

function calculateToolResult(tool, values) {
  const fields = tool?.fields || [];
  const missingFields = fields.filter((field) => isFieldMissing(field, values[field.id]));

  if (missingFields.length > 0) {
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
    const value = evaluateSafeFormula(tool.engineConfig?.formula, variables);

    return {
      ready: value != null,
      missingFields: [],
      value,
      range: findResultRange(value, tool.resultRanges),
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
  if (!tool || !result?.ready) {
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

function ClinicalToolSidebar({
  query,
  setQuery,
  tools,
  selectedSlug,
  setSelectedSlug,
  loadingTools,
  error,
}) {
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

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loadingTools ? (
          <div className="prescription-empty">Buscando ferramentas...</div>
        ) : tools.length > 0 ? (
          tools.map((tool) => (
            <button
              key={tool.slug}
              type="button"
              className={`protocol-result-item ${tool.slug === selectedSlug ? 'active' : ''}`}
              onClick={() => setSelectedSlug(tool.slug)}
            >
              <strong>{getToolTitle(tool)}</strong>
              <span>{getToolMeta(tool).join(' · ') || 'Ferramenta clínica'}</span>
            </button>
          ))
        ) : (
          <div className="prescription-empty">Nenhuma ferramenta encontrada.</div>
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

function OptionGroupField({ field, value, onChange }) {
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
              className={`clinical-tool-option ${checked ? 'selected' : ''}`}
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
              <em>{formatResultValue(option.numericValue, 1)}</em>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ClinicalToolField({ field, value, onChange }) {
  if (field.inputType === 'number') {
    return <NumberField field={field} value={value} onChange={onChange} />;
  }

  if (field.inputType === 'select') {
    return <SelectField field={field} value={value} onChange={onChange} />;
  }

  return <OptionGroupField field={field} value={value} onChange={onChange} />;
}

function ClinicalToolResult({ tool, result, copied, onCopy }) {
  const precision = tool?.engineConfig?.precision ?? 1;
  const unit = tool?.engineConfig?.unit ? ` ${tool.engineConfig.unit}` : '';
  const resultLabel = tool?.engineConfig?.resultLabel || 'Resultado';
  const scoreLabel = tool?.engineConfig?.scoreLabel || 'pontos';
  const valueText = result?.ready
    ? `${formatResultValue(result.value, precision)}${unit || (tool.toolType === 'math_formula' ? '' : ` ${scoreLabel}`)}`
    : '--';

  if (!result?.ready) {
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

  const color = result.range?.alertColor || 'gray';

  return (
    <section className={`clinical-tool-result-card ${color}`}>
      <div className="clinical-tool-result-header">
        <div>
          <span>{resultLabel}</span>
          <h3>{valueText}</h3>
        </div>
        {result.range?.classification ? (
          <strong>{result.range.classification}</strong>
        ) : null}
      </div>

      {result.range?.orientation ? <p>{result.range.orientation}</p> : null}
      {RESULT_COLOR_LABELS[color] ? (
        <small>Categoria visual: {RESULT_COLOR_LABELS[color]}.</small>
      ) : null}

      <button type="button" className="btn btn-secundario" onClick={onCopy}>
        {copied ? 'Copiado' : 'Copiar resultado'}
      </button>
    </section>
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
}) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [tools, setTools] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
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
      const response = await api.get(`/clinical-tools?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setTools(response.data);

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
  }, [isPro, query, selectedSlug, user?.id]);

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

  const result = useMemo(() => {
    if (!selectedTool) {
      return null;
    }

    return calculateToolResult(selectedTool, values);
  }, [selectedTool, values]);

  const headerCopy = useMemo(() => {
    if (accessState?.isTrialAccess) {
      return 'Use scores, calculadoras e questionários clínicos durante o teste profissional.';
    }

    return 'Busque scores, calculadoras e questionários clínicos sincronizados do Notion.';
  }, [accessState?.isTrialAccess]);

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
          <span className="workspace-kicker">Ferramentas clínicas</span>
          <h1>Entre para usar scores e calculadoras</h1>
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
          <span className="workspace-kicker">Ferramentas clínicas</span>
          <h1>Recurso do plano profissional</h1>
          <p>Scores, calculadoras e questionários clínicos ficam liberados no plano profissional.</p>
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
          <span className="workspace-kicker">Ferramentas clínicas</span>
          <h1>Scores, calculadoras e questionários</h1>
          <p>{headerCopy}</p>
        </div>
      </section>

      <section className="prescription-guide-grid clinical-tool-grid">
        <ClinicalToolSidebar
          query={query}
          setQuery={setQuery}
          tools={tools}
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
                  {selectedTool.fields.map((field) => (
                    <ClinicalToolField
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onChange={(value) => updateFieldValue(field.id, value)}
                    />
                  ))}
                </form>

                <div className="clinical-tool-result-column">
                  <ClinicalToolResult
                    tool={selectedTool}
                    result={result}
                    copied={copied}
                    onCopy={handleCopyResult}
                  />

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
    </main>
  );
}

export default ClinicalToolsPage;
