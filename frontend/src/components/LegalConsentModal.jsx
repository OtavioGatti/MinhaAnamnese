import { useEffect, useRef, useState } from 'react';
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_VERSION } from './LegalDocumentPage';

const SCROLL_END_TOLERANCE = 12;

function hasReachedScrollEnd(element) {
  if (!element) {
    return false;
  }

  return element.scrollTop + element.clientHeight >= element.scrollHeight - SCROLL_END_TOLERANCE;
}

function LegalDocumentContent({ document }) {
  return (
    <>
      {document.intro.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {document.sections.map((section) => (
        <section key={section.title} className="legal-consent-section">
          <h3>{section.title}</h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </>
  );
}

function LegalConsentModal({ open, loading = false, onCancel, onComplete }) {
  const scrollRegionRef = useRef(null);
  const [step, setStep] = useState('terms');
  const [termsScrolledAt, setTermsScrolledAt] = useState('');
  const [privacyScrolledAt, setPrivacyScrolledAt] = useState('');

  const isPrivacyStep = step === 'privacy';
  const document = isPrivacyStep ? LEGAL_DOCUMENTS.privacy : LEGAL_DOCUMENTS.terms;
  const currentScrolledAt = isPrivacyStep ? privacyScrolledAt : termsScrolledAt;

  const markCurrentDocumentAsRead = () => {
    const now = new Date().toISOString();

    if (isPrivacyStep) {
      setPrivacyScrolledAt((current) => current || now);
      return;
    }

    setTermsScrolledAt((current) => current || now);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep('terms');
    setTermsScrolledAt('');
    setPrivacyScrolledAt('');
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const scrollRegion = scrollRegionRef.current;

    if (!scrollRegion) {
      return undefined;
    }

    scrollRegion.scrollTop = 0;

    const timeoutId = window.setTimeout(() => {
      if (hasReachedScrollEnd(scrollRegion)) {
        markCurrentDocumentAsRead();
      }
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [open, step]);

  if (!open) {
    return null;
  }

  const handleScroll = () => {
    if (hasReachedScrollEnd(scrollRegionRef.current)) {
      markCurrentDocumentAsRead();
    }
  };

  const handlePrimaryAction = () => {
    if (!currentScrolledAt || loading) {
      return;
    }

    if (!isPrivacyStep) {
      setStep('privacy');
      return;
    }

    const acceptedAt = new Date().toISOString();

    onComplete({
      acceptedAt,
      termsScrolledAt: termsScrolledAt || acceptedAt,
      privacyScrolledAt: privacyScrolledAt || acceptedAt,
      version: LEGAL_DOCUMENT_VERSION,
    });
  };

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={loading ? undefined : onCancel}>
      <article
        className="app-modal-card legal-consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-consent-title"
        aria-describedby="legal-consent-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header legal-consent-header">
          <div>
            <span className="workspace-kicker">Documento obrigatório</span>
            <h2 id="legal-consent-title">{document.title}</h2>
            <p id="legal-consent-description">
              Role o documento até o final para confirmar a leitura e continuar o cadastro.
            </p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
        </header>

        <div className="legal-consent-progress" aria-label="Progresso da leitura obrigatória">
          <span className={termsScrolledAt ? 'done' : 'active'}>1. Termos de Uso</span>
          <span className={privacyScrolledAt ? 'done' : isPrivacyStep ? 'active' : ''}>2. Política de Privacidade</span>
        </div>

        <div className="legal-consent-meta">
          <span>Última atualização: {document.lastUpdated}</span>
          <a href={isPrivacyStep ? '/privacidade' : '/termos'} target="_blank" rel="noreferrer">
            Abrir página completa
          </a>
        </div>

        <div
          ref={scrollRegionRef}
          className="legal-consent-scroll-region"
          onScroll={handleScroll}
          tabIndex={0}
        >
          <LegalDocumentContent document={document} />
        </div>

        <div className={`legal-consent-read-status ${currentScrolledAt ? 'done' : ''}`}>
          {currentScrolledAt
            ? 'Leitura registrada até o final.'
            : 'Continue rolando para liberar a próxima etapa.'}
        </div>

        <footer className="app-modal-actions legal-consent-actions">
          {isPrivacyStep ? (
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setStep('terms')}
              disabled={loading}
            >
              Voltar aos termos
            </button>
          ) : (
            <button type="button" className="btn btn-secundario" onClick={onCancel} disabled={loading}>
              Voltar ao cadastro
            </button>
          )}

          <button
            type="button"
            className="btn btn-primario"
            onClick={handlePrimaryAction}
            disabled={!currentScrolledAt || loading}
          >
            {loading
              ? 'Criando conta...'
              : isPrivacyStep
                ? 'Li e concordo. Criar minha conta'
                : 'Li os Termos de Uso e continuar'}
          </button>
        </footer>
      </article>
    </div>
  );
}

export default LegalConsentModal;
