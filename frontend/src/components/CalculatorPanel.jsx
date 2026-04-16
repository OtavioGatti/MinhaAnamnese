import { useMemo, useState } from 'react';
import {
  calcularDPP,
  calcularDPPporIG,
  calcularIGPorDUM,
  calcularIGPorUSG,
  getTodayInputValue,
} from '../utils/obstetricCalculations';

const calculators = [
  { id: 'ig', label: 'IG' },
  { id: 'dpp', label: 'DPP' },
  { id: 'ig-para-dpp', label: 'IG para DPP' },
];

const igModes = [
  { id: 'dum', label: 'DUM' },
  { id: 'usg', label: 'USG' },
];

function CalculatorPanel() {
  const [activeCalculator, setActiveCalculator] = useState('ig');
  const [igMode, setIgMode] = useState('dum');
  const [dum, setDum] = useState('');
  const [referenceDate, setReferenceDate] = useState(getTodayInputValue);
  const [usgDate, setUsgDate] = useState('');
  const [usgWeeks, setUsgWeeks] = useState('');
  const [usgDays, setUsgDays] = useState('');
  const [dumForDpp, setDumForDpp] = useState('');
  const [currentIgWeeks, setCurrentIgWeeks] = useState('');
  const [currentDate, setCurrentDate] = useState(getTodayInputValue);

  const igByDumResult = useMemo(() => {
    if (!dum) {
      return null;
    }

    return calcularIGPorDUM(dum, referenceDate);
  }, [dum, referenceDate]);

  const igByUsgResult = useMemo(() => {
    if (!usgDate && usgWeeks === '' && usgDays === '') {
      return null;
    }

    return calcularIGPorUSG({
      usgDateInput: usgDate,
      usgWeeksInput: usgWeeks,
      usgDaysInput: usgDays,
      referenceDateInput: referenceDate,
    });
  }, [referenceDate, usgDate, usgWeeks, usgDays]);

  const dppResult = useMemo(() => {
    if (!dumForDpp) {
      return null;
    }

    return calcularDPP(dumForDpp);
  }, [dumForDpp]);

  const dppByIgResult = useMemo(() => {
    if (currentIgWeeks === '') {
      return null;
    }

    return calcularDPPporIG(currentIgWeeks, currentDate);
  }, [currentDate, currentIgWeeks]);

  const activeIgResult = igMode === 'dum' ? igByDumResult : igByUsgResult;

  const renderResult = (result, formatSuccess) => {
    if (!result) {
      return <p className="calculator-placeholder">Preencha os campos para visualizar o cálculo.</p>;
    }

    if (!result.success) {
      return <p className="calculator-error">{result.error}</p>;
    }

    return (
      <div className="calculator-result">
        <p>{formatSuccess(result.data)}</p>
      </div>
    );
  };

  return (
    <aside className="calculator-panel">
      <div className="calculator-panel-header">
        <div>
          <h3>Cálculos clínicos</h3>
          <p>Obstetrícia</p>
        </div>
      </div>

      <div className="calculator-tabs" role="tablist" aria-label="Cálculos clínicos">
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
        {activeCalculator === 'ig' && (
          <section className="calculator-section">
            <div className="calculator-subtabs" role="tablist" aria-label="Método de cálculo da idade gestacional">
              {igModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`calculator-subtab ${igMode === mode.id ? 'active' : ''}`}
                  onClick={() => setIgMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {igMode === 'dum' && (
              <>
                <div className="calculator-field">
                  <label htmlFor="calculator-dum">DUM</label>
                  <input
                    id="calculator-dum"
                    type="date"
                    value={dum}
                    onChange={(e) => setDum(e.target.value)}
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
              </>
            )}

            {igMode === 'usg' && (
              <>
                <div className="calculator-field">
                  <label htmlFor="calculator-usg-date">Data da ultrassonografia</label>
                  <input
                    id="calculator-usg-date"
                    type="date"
                    value={usgDate}
                    onChange={(e) => setUsgDate(e.target.value)}
                  />
                </div>

                <div className="calculator-inline-fields">
                  <div className="calculator-field">
                    <label htmlFor="calculator-usg-weeks">IG na ultrassonografia (semanas)</label>
                    <input
                      id="calculator-usg-weeks"
                      type="number"
                      min="0"
                      max="40"
                      step="1"
                      value={usgWeeks}
                      onChange={(e) => setUsgWeeks(e.target.value)}
                      placeholder="Ex.: 12"
                    />
                  </div>

                  <div className="calculator-field">
                    <label htmlFor="calculator-usg-days">Dias</label>
                    <input
                      id="calculator-usg-days"
                      type="number"
                      min="0"
                      max="6"
                      step="1"
                      value={usgDays}
                      onChange={(e) => setUsgDays(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="calculator-field">
                  <label htmlFor="calculator-reference-date-usg">Data de referência</label>
                  <input
                    id="calculator-reference-date-usg"
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {renderResult(activeIgResult, (data) => data.formatted)}
          </section>
        )}

        {activeCalculator === 'dpp' && (
          <section className="calculator-section">
            <div className="calculator-field">
              <label htmlFor="calculator-dpp-dum">DUM</label>
              <input
                id="calculator-dpp-dum"
                type="date"
                value={dumForDpp}
                onChange={(e) => setDumForDpp(e.target.value)}
              />
            </div>

            {renderResult(dppResult, (data) => `DPP: ${data.formatted}`)}
          </section>
        )}

        {activeCalculator === 'ig-para-dpp' && (
          <section className="calculator-section">
            <div className="calculator-field">
              <label htmlFor="calculator-current-ig">IG atual (semanas)</label>
              <input
                id="calculator-current-ig"
                type="number"
                min="0"
                max="40"
                step="1"
                value={currentIgWeeks}
                onChange={(e) => setCurrentIgWeeks(e.target.value)}
                placeholder="Ex.: 32"
              />
            </div>

            <div className="calculator-field">
              <label htmlFor="calculator-current-date">Data de avaliação</label>
              <input
                id="calculator-current-date"
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />
            </div>

            {renderResult(dppByIgResult, (data) => `DPP: ${data.formatted}`)}
          </section>
        )}
      </div>
    </aside>
  );
}

export default CalculatorPanel;
