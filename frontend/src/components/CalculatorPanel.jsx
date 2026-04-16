import { useMemo, useState } from 'react';
import {
  calcularDPP,
  calcularDPPporIG,
  calcularIG,
  getTodayInputValue,
} from '../utils/obstetricCalculations';

const calculators = [
  { id: 'ig-dum', label: 'IG por DUM' },
  { id: 'dpp-dum', label: 'DPP' },
  { id: 'ig-para-dpp', label: 'IG -> DPP' },
];

function CalculatorPanel() {
  const [activeCalculator, setActiveCalculator] = useState(calculators[0].id);
  const [dumForIG, setDumForIG] = useState('');
  const [referenceDate, setReferenceDate] = useState(getTodayInputValue);
  const [dumForDPP, setDumForDPP] = useState('');
  const [igWeeks, setIgWeeks] = useState('');
  const [currentDate, setCurrentDate] = useState(getTodayInputValue);

  const igResult = useMemo(
    () => (dumForIG ? calcularIG(dumForIG, referenceDate) : null),
    [dumForIG, referenceDate],
  );

  const dppFromDumResult = useMemo(
    () => (dumForDPP ? calcularDPP(dumForDPP) : null),
    [dumForDPP],
  );

  const dppFromIgResult = useMemo(
    () => (igWeeks !== '' ? calcularDPPporIG(igWeeks, currentDate) : null),
    [igWeeks, currentDate],
  );

  const renderResult = (result, successLabel) => {
    if (!result) {
      return <p className="calculator-placeholder">Preencha os campos para ver o resultado.</p>;
    }

    if (!result.success) {
      return <p className="calculator-error">{result.error}</p>;
    }

    return (
      <div className="calculator-result">
        <p>{successLabel(result.data)}</p>
      </div>
    );
  };

  return (
    <aside className="calculator-panel">
      <div className="calculator-panel-header">
        <div>
          <h3>Calculadoras</h3>
          <p>Obstetrícia</p>
        </div>
      </div>

      <div className="calculator-tabs" role="tablist" aria-label="Calculadoras clínicas">
        {calculators.map((calculator) => (
          <button
            key={calculator.id}
            type="button"
            className={`calculator-tab ${activeCalculator === calculator.id ? 'active' : ''}`}
            onClick={() => setActiveCalculator(calculator.id)}
          >
            {calculator.label}
          </button>
        ))}
      </div>

      <div className="calculator-body">
        {activeCalculator === 'ig-dum' && (
          <section className="calculator-section">
            <div className="calculator-field">
              <label htmlFor="calculator-dum-ig">DUM</label>
              <input
                id="calculator-dum-ig"
                type="date"
                value={dumForIG}
                onChange={(e) => setDumForIG(e.target.value)}
              />
            </div>

            <div className="calculator-field">
              <label htmlFor="calculator-reference-date">Data de referência</label>
              <input
                id="calculator-reference-date"
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
              />
            </div>

            {renderResult(igResult, (data) => data.formatted)}
          </section>
        )}

        {activeCalculator === 'dpp-dum' && (
          <section className="calculator-section">
            <div className="calculator-field">
              <label htmlFor="calculator-dum-dpp">DUM</label>
              <input
                id="calculator-dum-dpp"
                type="date"
                value={dumForDPP}
                onChange={(e) => setDumForDPP(e.target.value)}
              />
            </div>

            {renderResult(dppFromDumResult, (data) => `DPP: ${data.formatted}`)}
          </section>
        )}

        {activeCalculator === 'ig-para-dpp' && (
          <section className="calculator-section">
            <div className="calculator-field">
              <label htmlFor="calculator-ig-weeks">IG atual (semanas)</label>
              <input
                id="calculator-ig-weeks"
                type="number"
                min="0"
                max="40"
                step="1"
                value={igWeeks}
                onChange={(e) => setIgWeeks(e.target.value)}
                placeholder="Ex: 32"
              />
            </div>

            <div className="calculator-field">
              <label htmlFor="calculator-current-date">Data atual</label>
              <input
                id="calculator-current-date"
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />
            </div>

            {renderResult(dppFromIgResult, (data) => `DPP: ${data.formatted}`)}
          </section>
        )}
      </div>
    </aside>
  );
}

export default CalculatorPanel;
