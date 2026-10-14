import { useEffect, useRef, useState } from 'react';
import { formatBrazilianMobileInput, normalizeBrazilianMobile, PHONE_INVALID_MESSAGE } from '../lib/phone';

// Celular de quem já tinha conta antes do campo existir no cadastro. Aparece
// ao clicar em Organizar; "Agora não" só enquanto ainda dá para adiar.
function PhoneCaptureModal({ open, canSkip, onSave, onSkip }) {
  const [phone, setPhone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setError('');
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const digits = normalizeBrazilianMobile(phone);

    if (!digits) {
      setError(PHONE_INVALID_MESSAGE);
      return;
    }

    setSaving(true);
    setError('');
    const result = await onSave(digits, whatsappOptIn);
    setSaving(false);

    if (!result?.ok) {
      setError(result?.error || 'Não foi possível salvar o celular agora.');
    }
  };

  return (
    <div className="app-modal-backdrop" role="presentation">
      <form
        className="app-modal-card phone-capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-capture-title"
        onSubmit={handleSubmit}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Complete seu cadastro</span>
            <h2 id="phone-capture-title">Qual é o seu celular?</h2>
            <p>Usamos para falar com você sobre sua conta e o suporte. Leva 10 segundos.</p>
          </div>
        </div>

        <label className="phone-capture-label" htmlFor="phone-capture-input">Celular com DDD</label>
        <input
          id="phone-capture-input"
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className="topbar-auth-input"
          placeholder="(11) 98765-4321"
          value={phone}
          onChange={(event) => {
            setPhone(formatBrazilianMobileInput(event.target.value));
            setError('');
          }}
          disabled={saving}
        />

        <label className="signup-whatsapp-optin">
          <input
            type="checkbox"
            checked={whatsappOptIn}
            onChange={(event) => setWhatsappOptIn(event.target.checked)}
            disabled={saving}
          />
          <span>Aceito receber dicas e novidades pelo WhatsApp. Posso cancelar quando quiser.</span>
        </label>

        {error ? <div className="topbar-auth-error">{error}</div> : null}

        <div className="app-modal-actions">
          {canSkip ? (
            <button type="button" className="btn btn-secundario" onClick={onSkip} disabled={saving}>
              Agora não
            </button>
          ) : null}
          <button type="submit" className="btn btn-primario" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar e organizar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PhoneCaptureModal;
