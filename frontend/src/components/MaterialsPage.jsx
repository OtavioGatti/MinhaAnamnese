import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';
import { API_BASE_URL } from '../config';
import { supabase } from '../lib/supabaseClient';

const SEARCH_DEBOUNCE_MS = 280;

const TYPE_LABELS = {
  proprio: 'Impresso',
  escala_livre: 'Escala',
  link_oficial: 'Página oficial',
};

function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }

  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function groupByCategory(materials) {
  const groups = new Map();

  materials.forEach((material) => {
    const key = material.category || 'Outros';

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(material);
  });

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

// O PDF fica num bucket privado: quem entrega é a API, com o token da sessão.
// Por isso o download é um fetch autenticado, e não um link direto.
async function downloadMaterialPdf(slug) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token || '';
  const response = await fetch(`${API_BASE_URL}/materials/download?slug=${encodeURIComponent(slug)}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || !contentType.includes('application/pdf')) {
    const json = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};

    return {
      success: false,
      status: response.status,
      paywall: response.status === 402,
      error: json.error || 'Não foi possível baixar o arquivo agora.',
    };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${slug}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);

  return { success: true };
}

function MaterialCard({ material, busy, onDownload, onOpenLink, onRequestUpgrade }) {
  const isLink = material.type === 'link_oficial';
  const size = formatFileSize(material.fileSize);

  return (
    <article className={`material-card ${material.locked ? 'locked' : ''}`}>
      <div className="material-card-head">
        <span className="material-card-type">{TYPE_LABELS[material.type] || 'Material'}</span>
        {material.locked ? <span className="material-card-pro">Plano profissional</span> : null}
      </div>
      <h3>{material.title}</h3>
      {material.description ? <p>{material.description}</p> : null}
      {material.credit ? <p className="material-card-credit">{material.credit}</p> : null}

      <div className="material-card-actions">
        {material.locked ? (
          <button type="button" className="btn btn-secundario" onClick={onRequestUpgrade}>
            Assinar para acessar
          </button>
        ) : isLink ? (
          <a
            className="btn btn-secundario"
            href={material.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpenLink(material)}
          >
            Abrir página oficial
          </a>
        ) : (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => onDownload(material)}
            disabled={busy || !material.hasFile}
          >
            {busy ? 'Baixando...' : 'Baixar PDF'}
          </button>
        )}
        {!material.locked && !isLink && size ? <span className="material-card-size">PDF · {size}</span> : null}
      </div>
    </article>
  );
}

export default function MaterialsPage({
  user,
  isPro,
  onLogin,
  onRequestUpgrade,
  onMaterialDownloaded,
  onMaterialLinkOpened,
}) {
  const [query, setQuery] = useState('');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [downloadingSlug, setDownloadingSlug] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setMaterials([]);
      setLoadedOnce(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({ q: query.trim() });
      const response = await api.get(`/materials?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setMaterials(response.data);
      } else {
        setMaterials([]);
        setError(response.error || 'Não foi possível carregar os materiais.');
      }

      setLoading(false);
      setLoadedOnce(true);
    }, loadedOnce ? SEARCH_DEBOUNCE_MS : 0);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
    // isPro entra para recarregar a lista (e os cadeados) quando o plano muda.
  }, [isPro, query, user?.id]);

  const groups = useMemo(() => groupByCategory(materials), [materials]);

  async function handleDownload(material) {
    if (downloadingSlug) {
      return;
    }

    setDownloadingSlug(material.slug);
    setDownloadError('');

    const result = await downloadMaterialPdf(material.slug).catch(() => ({
      success: false,
      error: 'Não foi possível baixar o arquivo agora.',
    }));

    setDownloadingSlug('');

    if (result.success) {
      onMaterialDownloaded?.(material.slug);
      return;
    }

    if (result.paywall) {
      onRequestUpgrade?.();
      return;
    }

    setDownloadError(result.error);
  }

  if (!user?.id) {
    return (
      <main className="prescription-guide-page materials-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Materiais</span>
          <h1>Entre para baixar os materiais</h1>
          <p>Tabelas de controle e diários prontos para imprimir e entregar ao paciente. Grátis para quem tem conta.</p>
          <button type="button" className="btn btn-primario prescription-access-action" onClick={onLogin}>
            Entrar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="prescription-guide-page materials-page">
      <header className="prescription-guide-header materials-header">
        <div>
          <span className="workspace-kicker">Materiais</span>
          <h1>Impressos para entregar ao paciente</h1>
          <p>Tabelas de controle e diários em PDF, prontos para imprimir. Os impressos são gratuitos para qualquer conta.</p>
        </div>
        <div className="materials-search">
          <label className="protocol-search-label" htmlFor="materials-search">Buscar material</label>
          <input
            id="materials-search"
            className="protocol-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: pressão, glicemia, sono"
          />
        </div>
      </header>

      {error ? <p className="materials-message error" role="alert">{error}</p> : null}
      {downloadError ? <p className="materials-message error" role="alert">{downloadError}</p> : null}
      {!loadedOnce && loading ? <p className="materials-message">Carregando materiais...</p> : null}
      {loadedOnce && !loading && !error && materials.length === 0 ? (
        <p className="materials-message">
          {query.trim() ? 'Nenhum material encontrado para essa busca.' : 'Nenhum material disponível ainda.'}
        </p>
      ) : null}

      {groups.map(([category, items]) => (
        <section key={category} className="materials-group">
          <h2>{category}</h2>
          <div className="materials-grid">
            {items.map((material) => (
              <MaterialCard
                key={material.slug}
                material={material}
                busy={downloadingSlug === material.slug}
                onDownload={handleDownload}
                onOpenLink={(item) => onMaterialLinkOpened?.(item.slug)}
                onRequestUpgrade={onRequestUpgrade}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
