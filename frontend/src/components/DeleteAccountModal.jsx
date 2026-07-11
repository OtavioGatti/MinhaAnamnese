import { useEffect, useState } from 'react';

function DeleteAccountModal({ open, loading, error, accountEmail, onClose, onConfirm }) {
  const [typedEmail, setTypedEmail] = useState('');

  useEffect(() => {
    if (!open) {
      setTypedEmail('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const normalizedTyped = typedEmail.trim().toLowerCase();
  const normalizedAccount = String(accountEmail || '').trim().toLowerCase();
  const canDelete = Boolean(normalizedAccount) && normalizedTyped === normalizedAccount;

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Conta</span>
            <h2 id="delete-account-title">Excluir sua conta?</h2>
            <p>
              Esta ação é <strong>permanente</strong>. Seu perfil e seu histórico de anamneses serão apagados e não
              podem ser recuperados. Uma assinatura ativa é cancelada automaticamente.
            </p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="delete-account-confirm">
          <label htmlFor="delete-account-email">
            Para confirmar, digite seu e-mail: <strong>{accountEmail}</strong>
          </label>
          <input
            id="delete-account-email"
            type="email"
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
            placeholder="seu e-mail"
            autoComplete="off"
          />
        </div>

        {error ? <div className="templates-inline-error">{error}</div> : null}

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose} disabled={loading}>
            Manter minha conta
          </button>
          <button
            type="button"
            className="btn btn-perigo"
            onClick={onConfirm}
            disabled={loading || !canDelete}
          >
            {loading ? 'Excluindo...' : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAccountModal;
