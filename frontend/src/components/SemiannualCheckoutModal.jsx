import { useEffect, useRef, useState } from 'react';
import { loadMercadoPagoSdk } from '../lib/cardCheckout';

const CONTAINER_ID = 'semiannual-checkout-brick';

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function formatHour(value) {
  const data = new Date(value || '');
  return Number.isNaN(data.getTime())
    ? ''
    : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Pagamento do plano semestral aqui mesmo: cartão de crédito à vista ou Pix.
 *
 * O formulário é o Payment Brick do Mercado Pago (aplicação só do semestral).
 * Cartão vira token no navegador; Pix vira QR Code gerado pelo servidor.
 * `onSubmitPayment` recebe o que o Brick devolve e resolve com o resultado do
 * servidor (describeSemiannualResult).
 */
function SemiannualCheckoutModal({
  open,
  publicKey,
  email,
  amount,
  listPrice,
  stage,
  message,
  pix,
  onSubmitPayment,
  onClose,
  onFallback,
  onRestart,
}) {
  const controllerRef = useRef(null);
  const codigoPixRef = useRef(null);
  // O Brick guarda o callback da hora em que foi criado.
  const onSubmitRef = useRef(onSubmitPayment);
  onSubmitRef.current = onSubmitPayment;
  const [carregando, setCarregando] = useState(true);
  const [falhaAoCarregar, setFalhaAoCarregar] = useState(false);
  // '' | 'copiado' | 'selecionado' (sem permissão para a área de transferência)
  const [copia, setCopia] = useState('');
  const mostraFormulario = stage === 'formulario' || stage === 'enviando';

  useEffect(() => {
    if (!open || !mostraFormulario) {
      return undefined;
    }

    let cancelado = false;
    setCarregando(true);
    setFalhaAoCarregar(false);

    loadMercadoPagoSdk()
      .then(async (MercadoPago) => {
        if (cancelado) {
          return;
        }

        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        const controller = await mp.bricks().create('payment', CONTAINER_ID, {
          initialization: {
            amount: Number(amount) || 0,
            payer: { email },
          },
          customization: {
            paymentMethods: {
              // À vista: parcelado exige o valor já com os juros no pedido.
              creditCard: 'all',
              bankTransfer: 'all',
              maxInstallments: 1,
            },
            visual: {
              texts: {
                formSubmit: `Pagar ${formatCurrencyBRL(amount)}`,
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) {
                setCarregando(false);
              }
            },
            // Rejeitar a promessa mantém o formulário na tela para tentar de novo.
            onSubmit: async (dados) => {
              const resultado = await onSubmitRef.current(dados);

              if (!['aprovado', 'pix', 'em_analise'].includes(resultado?.kind)) {
                throw new Error(resultado?.kind || 'erro');
              }
            },
            onError: () => {
              if (!cancelado) {
                setCarregando(false);
              }
            },
          },
        });

        if (cancelado) {
          controller?.unmount?.();
          return;
        }

        controllerRef.current = controller;
      })
      .catch(() => {
        if (!cancelado) {
          setCarregando(false);
          setFalhaAoCarregar(true);
        }
      });

    return () => {
      cancelado = true;
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
    // O formulário é montado uma vez por abertura; mudar valor ou e-mail no
    // meio exigiria recriar o Brick e perder o que a pessoa digitou.
  }, [open, mostraFormulario, publicKey]);

  if (!open) {
    return null;
  }

  // Alguns navegadores e celulares negam a área de transferência. Aí o código
  // fica selecionado no campo, para copiar à mão, em vez de falhar calado.
  const copiarCodigo = async () => {
    let resultado = 'copiado';

    try {
      await navigator.clipboard.writeText(pix?.qr_code || '');
    } catch {
      codigoPixRef.current?.focus();
      codigoPixRef.current?.select();
      resultado = typeof document.execCommand === 'function' && document.execCommand('copy') ? 'copiado' : 'selecionado';
    }

    setCopia(resultado);
    setTimeout(() => setCopia(''), 4000);
  };

  const temDesconto = Number(listPrice) > Number(amount);
  const titulo = {
    pix: 'Pague com Pix',
    em_analise: 'Pagamento em análise',
    confirmado: 'Pagamento confirmado',
    encerrado: 'O código Pix expirou',
  }[stage] || 'Plano semestral';

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={stage === 'enviando' ? undefined : onClose}>
      <div
        className="app-modal-card card-checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="semiannual-checkout-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Plano Profissional Semestral</span>
            <h2 id="semiannual-checkout-title">{titulo}</h2>
            {mostraFormulario ? (
              <p>
                {temDesconto ? <s className="card-checkout-list-price">{formatCurrencyBRL(listPrice)}</s> : null}
                {' '}
                <strong>{formatCurrencyBRL(amount)}</strong> à vista, por 6 meses de acesso. Pagamento único, sem
                renovação automática.
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose} disabled={stage === 'enviando'}>
            Fechar
          </button>
        </div>

        {stage === 'pix' && pix ? (
          <div className="pix-checkout">
            <p className="card-checkout-status" role="status">
              Aguardando o pagamento. Assim que o Pix cair, o acesso é liberado nesta tela.
            </p>
            {pix.qr_code_base64 ? (
              <img
                className="pix-checkout-qr"
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code do Pix"
                width="220"
                height="220"
              />
            ) : null}
            <label className="pix-checkout-label" htmlFor="pix-copia-e-cola">Pix copia e cola</label>
            <textarea
              ref={codigoPixRef}
              id="pix-copia-e-cola"
              className="pix-checkout-code"
              readOnly
              value={pix.qr_code}
              rows={3}
            />
            <button type="button" className="btn btn-primario" onClick={copiarCodigo}>
              {copia === 'copiado' ? 'Código copiado' : 'Copiar código Pix'}
            </button>
            {copia === 'selecionado' ? (
              <p className="card-checkout-footnote" role="status">
                O código está selecionado acima: copie com Ctrl+C, ou toque e segure no celular.
              </p>
            ) : null}
            {pix.expires_at ? (
              <p className="card-checkout-footnote">O código vale até {formatHour(pix.expires_at)}.</p>
            ) : null}
          </div>
        ) : null}

        {stage === 'em_analise' ? (
          <div className="card-checkout-done">
            <p>
              O banco está analisando o pagamento. Assim que ele aprovar, o acesso é liberado e você recebe um
              e-mail de confirmação. Pode continuar usando o site normalmente.
            </p>
          </div>
        ) : null}

        {stage === 'confirmado' ? (
          <div className="card-checkout-done">
            <p>Pagamento aprovado. Seu acesso profissional já está liberado por 6 meses.</p>
            <div className="app-modal-actions">
              <button type="button" className="btn btn-primario" onClick={onClose}>Continuar</button>
            </div>
          </div>
        ) : null}

        {stage === 'encerrado' ? (
          <div className="card-checkout-done">
            <p>Nenhuma cobrança foi feita. Gere um novo código ou pague com cartão.</p>
            <div className="app-modal-actions">
              <button type="button" className="btn btn-primario" onClick={onRestart}>Tentar de novo</button>
            </div>
          </div>
        ) : null}

        {mostraFormulario ? (
          <>
            {message ? <div className="templates-inline-error" role="alert">{message}</div> : null}

            {falhaAoCarregar ? (
              <div className="card-checkout-status">
                <p>Não foi possível carregar o formulário de pagamento.</p>
                <button type="button" className="btn btn-primario" onClick={onFallback}>
                  Pagar pela página do Mercado Pago
                </button>
              </div>
            ) : null}

            {carregando && !falhaAoCarregar ? (
              <div className="card-checkout-status" role="status">Carregando pagamento seguro...</div>
            ) : null}

            <div id={CONTAINER_ID} className="card-checkout-brick" />

            <p className="card-checkout-footnote">
              Cartão de crédito à vista ou Pix. Os dados do cartão são digitados no formulário seguro do Mercado
              Pago e não passam pelos nossos servidores. Não é preciso ter conta no Mercado Pago.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SemiannualCheckoutModal;
