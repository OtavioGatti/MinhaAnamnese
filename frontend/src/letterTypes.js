// Espelho leve do registro de tipos do backend (backend/config/letterTypes.js).
// Só o necessário para o frontend: rótulo e campos do formulário. As regras
// clínicas e o formato padrão vivem no servidor.
//
// `widget` e `hint` são exclusivos daqui: só mudam como o campo é apresentado.

export const LETTER_TYPES = [
  {
    key: 'encaminhamento',
    label: 'Encaminhamento',
    fields: [
      { name: 'specialty', label: 'Especialidade de destino', required: true, placeholder: 'Ex: Otorrinolaringologia' },
      { name: 'reason', label: 'Motivo do encaminhamento', required: false, placeholder: 'Ex: otorragia, perda auditiva, cefaleia refratária' },
    ],
  },
  {
    key: 'contrarreferencia',
    label: 'Contra-referência',
    fields: [
      { name: 'origin', label: 'Encaminhador / serviço de origem', required: true, placeholder: 'Ex: UBS Central / Dr. Fulano' },
      { name: 'conduct', label: 'Conduta realizada', required: false, placeholder: 'Ex: exames solicitados, medicação ajustada, retorno' },
    ],
  },
  {
    key: 'relatorio',
    label: 'Relatório médico',
    fields: [
      { name: 'purpose', label: 'Finalidade / destinatário', required: true, placeholder: 'Ex: perícia, escola, empregador, convênio' },
    ],
  },
  {
    key: 'solicitacao',
    label: 'Solicitação/justificativa',
    fields: [
      { name: 'procedure', label: 'Exame ou procedimento', required: true, placeholder: 'Ex: ressonância de crânio, fisioterapia' },
      { name: 'justification', label: 'Justificativa clínica', required: false, placeholder: 'Ex: cefaleia refratária com sinais de alarme' },
    ],
  },
  {
    key: 'declaracao',
    label: 'Declaração de comparecimento',
    fields: [
      { name: 'period', label: 'Data / período / horário', required: true, placeholder: 'Ex: 23/07/2026, das 14h às 15h30' },
      { name: 'companion', label: 'Acompanhante (opcional)', required: false, placeholder: 'Ex: mãe, Maria da Silva' },
    ],
  },
  {
    key: 'atestado',
    label: 'Atestado médico',
    fields: [
      { name: 'period', label: 'Tempo de afastamento', required: true, placeholder: 'Ex: 3 dias' },
      { name: 'startDate', label: 'Início do afastamento', required: false, placeholder: 'Ex: 10/08/2026 — vazio usa a data de hoje' },
      { name: 'activity', label: 'Atividades das quais se afasta', required: false, placeholder: 'Ex: atividades laborais' },
      {
        name: 'cid10',
        label: 'CID-10 (opcional)',
        required: false,
        placeholder: 'Ex: J06.9',
        widget: 'cid',
        hint: 'Com CID, o atestado sai com o termo de ciência e assinatura do paciente. Em branco, sai sem nenhuma menção a diagnóstico e assinado só por você.',
      },
    ],
  },
];

export const LETTER_TYPES_BY_KEY = LETTER_TYPES.reduce((acc, type) => {
  acc[type.key] = type;
  return acc;
}, {});

export const DEFAULT_LETTER_TYPE_KEY = 'encaminhamento';

export function getLetterType(key) {
  return LETTER_TYPES_BY_KEY[key] || LETTER_TYPES_BY_KEY[DEFAULT_LETTER_TYPE_KEY];
}
