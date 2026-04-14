import { useState, useEffect } from 'react';

function App() {
  const [templates, setTemplates] = useState([]);
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => setTemplates(data))
      .catch(() => setErro('Erro ao carregar templates.'));
  }, []);

  const handleOrganizar = async () => {
    setErro('');
    setResultado('');

    if (!templateSelecionado) {
      setErro('Selecione um modelo de anamnese.');
      return;
    }

    if (!texto.trim()) {
      setErro('Insira o texto da anamnese.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/organizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateSelecionado, texto }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || 'Erro ao processar.');
      }

      setResultado(data.resultado);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setTemplateSelecionado('');
    setTexto('');
    setResultado('');
    setErro('');
  };

  const handleCopiar = async () => {
    if (!resultado) return;

    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = resultado;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </div>
        <h1>Minha Anamnese</h1>
        <p>Organize suas anamneses com inteligência artificial</p>
      </header>

      <div className="aviso">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Não insira dados sensíveis identificáveis (nome, CPF, endereço). Use apenas informações clínicas.</span>
      </div>

      <div className="card">
        <div className="card-header">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <h2>Dados da Consulta</h2>
        </div>

        <div className="form-group">
          <label htmlFor="template">Modelo de Anamnese</label>
          <div className="input-wrapper">
            <select
              id="template"
              value={templateSelecionado}
              onChange={(e) => setTemplateSelecionado(e.target.value)}
            >
              <option value="">Selecione um modelo...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="texto">Anotações da Consulta</label>
          <div className="input-wrapper">
            <textarea
              id="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite ou cole as anotações da consulta aqui..."
            />
            {texto.length > 0 && (
              <span className="char-count">{texto.length} caracteres</span>
            )}
          </div>
        </div>

        <div className="botoes">
          <button
            className="btn btn-primario"
            onClick={handleOrganizar}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Processando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4"/>
                  <path d="m16.2 7.8 2.9-2.9"/>
                  <path d="M18 12h4"/>
                  <path d="m16.2 16.2 2.9 2.9"/>
                  <path d="M12 18v4"/>
                  <path d="m4.9 19.1 2.9-2.9"/>
                  <path d="M2 12h4"/>
                  <path d="m4.9 4.9 2.9 2.9"/>
                </svg>
                Organizar Anamnese
              </>
            )}
          </button>
          <button
            className="btn btn-secundario"
            onClick={handleLimpar}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            Limpar
          </button>
        </div>

        {erro && (
          <div className="erro">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{erro}</span>
          </div>
        )}
      </div>

      {resultado && (
        <div className="card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <h2>Anamnese Organizada</h2>
          </div>

          <div className="resultado-container">
            <div className="resultado">{resultado}</div>
            <button
              className={`btn btn-copiar ${copiado ? 'copiado' : ''}`}
              onClick={handleCopiar}
            >
              {copiado ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                  Copiar resultado
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>Minha Anamnese &middot; Processamento em tempo real &middot; Nenhum dado é armazenado</p>
      </footer>
    </div>
  );
}

export default App;
