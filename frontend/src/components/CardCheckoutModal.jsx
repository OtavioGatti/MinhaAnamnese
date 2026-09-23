import { useEffect, useRef, useState } from 'react';
import { loadMercadoPagoSdk } from '../lib/cardCheckout';

const CONTAINER_ID = 'card-checkout-brick';

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

/**
 * Pagamento da assinatura mensal com o cartão digitado aqui mesmo.
 *
 * O formulário é o Card Payment Brick do Mercado Pago: os campos do cartão
 * vivem em iframes deles e o cartão vira um token no navegador. `onSubmitCard`
 * recebe só esse token e resolve com o resultado do servidor
 * (describeCardCheckoutResult). Recusado, o formulário continua aberto para
 * corrigir ou trocar o cartão.
 */
function CardCheckoutModal({
  open,
  publicKey,
  email,
  amount,
  listPrice,
  stage,
  message,
  onSubmitCard,
  onClose,
  onFallback,
}) {
  const controllerRef = useRef(null);
  // O Brick guarda o callback da hora em que foi criado; a ref entrega sempre
  // a versão atual (com o estado atual do App).
  const onSubmitCardRef = useRef(onSubmitCard);
  onSubmitCardRef.current = onSubmitCard;
  const [carregando, setCarregando] = useState(true);
  const [falhaAoCarregar, setFalhaAoCarregar] = useState(false);
  const processando = stage === 'enviando' || stage === 'confirmando';
  const concluido = stage === 'confirmado' || stage === 'aguardando_cobranca';

  useEffect(() => {
    if (!open || concluido) {
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
        const controller = await mp.bricks().create('cardPayment', CONTAINER_ID, {
          initialization: {
            amount: Number(amount) || 0,
            payer: { email },
          },
          customization: {
            paymentMethods: {
              // Mensalidade: sem parcelas, e só crédito — débito e pré-pago
              // não aceitam cobrança recorrente.
              maxInstallments: 1,
              types: { excluded: ['debit_card', 'prepaid_card'] },
            },
            visual: {
              texts: {
                formTitle: 'Cartão de crédito',
                formSubmit: 'Assinar por ' + formatCurrencyBRL(amount) + '/mês',
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) {
                setCarregando(false);
              }
            },
            // O Brick espera a promessa para liberar o botão de novo. Rejeitar
            // mantém o formulário na tela para uma nova tentativa.
            onSubmit: async (cardFormData) => {
              const resultado = await onSubmitCardRef.current(cardFormData);

              if (resultado?.kind !== 'autorizada') {
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
  }, [open, concluido, publicKey]);

  if (!open) {
    return null;
  }

  const temDesconto = Number(listPrice) > Number(amount);

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={processando ? undefined : onClose}>
      <div
        className="app-modal-card card-checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-checkout-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Plano Profissional Mensal</span>
            <h2 id="card-checkout-title">
              {concluido ? 'Assinatura confirmada' : 'Assinar com cartão de crédito'}
            </h2>
            {!concluido ? (
              <p>
                {temDesconto ? <s className="card-checkout-list-price">{formatCurrencyBRL(listPrice)}</s> : null}
                {' '}
                <strong>{formatCurrencyBRL(amount)} por mês</strong>, cobrado automaticamente no cartão.
                Cancele quando quiser, direto no seu perfil.
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose} disabled={processando}>
            Fechar
          </button>
        </div>

        {concluido ? (
          <div className="card-checkout-done">
            {stage === 'confirmado' ? (
              <p>Pagamento aprovado. Seu acesso profissional já está liberado.</p>
            ) : (
              <p>
                Seu cartão foi aceito e a assinatura está ativa. O Mercado Pago está processando a primeira
                cobrança; assim que ela for aprovada o acesso profissional é liberado e você recebe um e-mail
                de confirmação. Pode continuar usando o site normalmente.
              </p>
            )}
            <div className="app-modal-actions">
              <button type="button" className="btn btn-primario" onClick={onClose}>
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <>
            {message ? <div className="templates-inline-error" role="alert">{message}</div> : null}
            {stage === 'confirmando' ? (
              <div className="card-checkout-status" role="status">Confirmando com o Mercado Pago...</div>
            ) : null}

            {falhaAoCarregar ? (
              <div className="card-checkout-status">
                <p>Não foi possível carregar o formulário de cartão.</p>
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
              Os dados do cartão são digitados no formulário seguro do Mercado Pago e não passam pelos nossos
              servidores. Não é preciso ter conta no Mercado Pago.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default CardCheckoutModal;
