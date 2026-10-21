import { useEffect, useRef, useState } from 'react';
import { api } from '../apiClient';
import {
  getSupportDeadline,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_TOPICS,
} from '../lib/supportTopics';

const SUPPORT_INBOX = 'minhaanamnese@gmail.com';

// "Fale com a gente" do rodapé. A mensagem vai por e-mail para o suporte; o
// servidor não guarda o texto. Quem está logado recebe a confirmação no e-mail
// da conta.
function SupportModal({ open, userEmail = '', onClose, onSent }) {
  const [topic, setTopic] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setError('');
    setSent(null);
    setEmail((current) => current || userEmail);
    window.setTimeout(() => firstFieldRef.current?.focus(), 60);

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, userEmail, onClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!topic) {
      setError('Escolha um assunto.');
      return;
    }

    if (message.trim().length < SUPPORT_MESSAGE_MIN) {
      setError('Conte um pouco mais sobre o que aconteceu.');
      return;
    }

    setSending(true);
    setError('');
    const response = await api.post('/support', { topic, email, name, message, website });
    setSending(false);

    if (!response?.success) {
      setError(response?.error || `Não foi possível enviar agora. Escreva para ${SUPPORT_INBOX}.`);
      return;
    }

    setSent({
      prazo: response.data?.prazo || getSupportDeadline(topic),
      porEmail: Boolean(response.data?.confirmacaoPorEmail),
    });
    setMessage('');
    onSent?.(topic);
  };

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="app-modal-card support-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Suporte</span>
            <h2 id="support-modal-title">Fale com a gente</h2>
            <p>Pagamento e assinatura: resposta em até 24 horas. Demais assuntos: em até 2 dias.</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        {sent ? (
          <div className="support-sent" role="status">
            <strong>Mensagem enviada.</strong>
            <p>
              Vamos responder no e-mail que você informou, {sent.prazo}.
              {sent.porEmail ? ' Mandamos uma confirmação para o e-mail da sua conta.' : ''}
            </p>
            <div className="app-modal-actions">
              <button type="button" className="btn btn-primario" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="support-label" htmlFor="support-topic">Assunto</label>
            <select
              id="support-topic"
              ref={firstFieldRef}
              className="topbar-auth-input"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setError('');
              }}
              disabled={sending}
            >
              <option value="">Escolha o assunto</option>
              {SUPPORT_TOPICS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>

            <div className="support-row">
              <div>
                <label className="support-label" htmlFor="support-email">Seu e-mail</label>
                <input
                  id="support-email"
                  type="email"
                  autoComplete="email"
                  className="topbar-auth-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={sending}
                />
              </div>
              <div>
                <label className="support-label" htmlFor="support-name">Nome <span>(opcional)</span></label>
                <input
                  id="support-name"
                  type="text"
                  autoComplete="name"
                  className="topbar-auth-input"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  disabled={sending}
                />
              </div>
            </div>

            <label className="support-label" htmlFor="support-message">Mensagem</label>
            <textarea
              id="support-message"
              className="topbar-auth-input support-message"
              rows={5}
              maxLength={SUPPORT_MESSAGE_MAX}
              placeholder="Conte o que aconteceu ou o que você precisa."
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError('');
              }}
              disabled={sending}
            />
            <p className="support-hint">Não envie dados de pacientes (nome, documento ou trechos da anamnese).</p>

            {/* Campo invisível: gente não vê; robô preenche e a mensagem não sai. */}
            <input
              type="text"
              name="website"
              className="support-honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />

            {error ? <div className="topbar-auth-error">{error}</div> : null}

            <div className="app-modal-actions">
              <button type="submit" className="btn btn-primario" disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
            <p className="support-hint">Se preferir, escreva direto para <a href={`mailto:${SUPPORT_INBOX}`}>{SUPPORT_INBOX}</a>.</p>
          </>
        )}
      </form>
    </div>
  );
}

export default SupportModal;
