export const LEGAL_DOCUMENT_VERSION = '2026-07-13';
export const LEGAL_LAST_UPDATED = '13/07/2026';

const TERMS_SECTIONS = [
  {
    title: '1. Natureza do Serviço e Aviso Médico',
    paragraphs: [
      'O Minha Anamnese é exclusivamente uma ferramenta de apoio à escrita e revisão clínica.',
      'O foco do produto é acelerar a escrita clínica, não substituindo o julgamento médico, o prontuário oficial ou a revisão profissional.',
      'O sistema não substitui julgamento clínico, diretrizes locais, bula oficial, prescrição médica individualizada ou prontuário institucional.',
      'Todo conteúdo gerado deve obrigatoriamente ser revisado por um profissional habilitado antes de qualquer uso assistencial.',
      'É de inteira responsabilidade do usuário conferir doses, alergias, contraindicações, idade, peso, gestação, função renal/hepática e protocolos locais antes de realizar qualquer prescrição com base nas informações do aplicativo.',
    ],
  },
  {
    title: '2. Responsabilidades do Usuário e Sigilo de Dados',
    paragraphs: [
      'Você é inteiramente responsável pelos dados inseridos na plataforma.',
      'É estritamente proibido inserir dados identificáveis do paciente, como nome completo, CPF, endereço ou telefone.',
      'A plataforma não deve ser utilizada como prontuário oficial. O usuário deve exportar as informações organizadas e arquivá-las no sistema de prontuário eletrônico oficial da sua instituição.',
    ],
  },
  {
    title: '3. Planos, Assinaturas e Pagamentos',
    paragraphs: [
      'O Minha Anamnese oferece um período de trial (teste) e um plano profissional.',
      'Durante o trial, o acesso aos recursos profissionais é liberado pelo período promocional vigente, sujeito apenas a limites técnicos de segurança, estabilidade e disponibilidade.',
      'O processamento de pagamentos para a liberação do plano profissional e o checkout são realizados de forma segura pela integração com o Mercado Pago.',
      'Em caso de cancelamento da assinatura, o acesso às funcionalidades premium será suspenso ao final do ciclo de faturamento vigente.',
      'Nos termos do art. 49 do Código de Defesa do Consumidor, você pode desistir de qualquer pagamento realizado através do Mercado Pago em até 7 (sete) dias corridos contados da data de aprovação do pagamento, sem necessidade de justificativa, solicitando o cancelamento pela própria plataforma. Nesse caso, o valor será integralmente estornado e o acesso aos recursos profissionais será encerrado imediatamente.',
      'Decorrido o prazo de 7 dias, o cancelamento da assinatura impede apenas cobranças futuras, mantendo o acesso já pago até o fim do ciclo vigente, sem direito a estorno proporcional.',
    ],
  },
  {
    title: '4. Propriedade Intelectual',
    paragraphs: [
      'Todos os direitos sobre a plataforma, incluindo seu código-fonte, templates oficiais, prompts, guias de prescrição e o bulário clínico, que são gerenciados via Notion e Supabase, pertencem ao Minha Anamnese.',
      'O uso da ferramenta não concede a você a propriedade intelectual sobre o software ou sobre os conteúdos editoriais oficiais fornecidos.',
    ],
  },
  {
    title: '5. Isenção de Responsabilidade',
    paragraphs: [
      'O Minha Anamnese e seus desenvolvedores não se responsabilizam por quaisquer danos, perdas ou prejuízos decorrentes de condutas médicas, diagnósticos ou tratamentos realizados com base nas informações geradas pelo sistema.',
      'A decisão clínica final é sempre do profissional de saúde.',
    ],
  },
  {
    title: '6. Programa de Afiliados',
    paragraphs: [
      'O Minha Anamnese oferece um programa de afiliados opcional. Ao gerar seu link de afiliado, você adere e concorda integralmente com as condições desta seção, que passam a reger essa relação sem necessidade de contrato individual adicional.',
      'A participação no programa constitui uma parceria comercial de indicação e não cria qualquer vínculo empregatício, societário, de representação comercial ou de exclusividade entre o afiliado e o Minha Anamnese.',
      'A comissão é devida sobre o valor efetivamente pago pelo cliente indicado (líquido de eventuais descontos) e apenas sobre pagamentos aprovados e confirmados. O percentual de comissão é definido pela empresa, pode variar por afiliado e ser ajustado a qualquer momento, a critério exclusivo da empresa e sem necessidade de aviso individual prévio.',
      'A comissão fica em carência durante o prazo de arrependimento do cliente indicado e só é considerada devida e disponível para saque após decorrido esse período. Caso o pagamento que gerou a comissão seja cancelado, reembolsado ou estornado por qualquer motivo, a comissão correspondente será automaticamente cancelada; se já tiver sido paga ao afiliado, o valor poderá ser descontado de comissões ou saques futuros.',
      'O pagamento das comissões ocorre mediante solicitação do afiliado, respeitado o valor mínimo definido pela empresa, por meio de transferência via PIX para a chave informada pelo próprio afiliado. A empresa não se responsabiliza por transferências feitas a chaves PIX informadas incorretamente pelo afiliado. Os tributos incidentes sobre os valores recebidos são de responsabilidade exclusiva do afiliado.',
      'É vedado ao afiliado: indicar a própria conta ou realizar autoindicação para obter comissão sobre a própria compra; praticar spam ou divulgação não autorizada; fazer promessas ou afirmações falsas ou enganosas sobre o produto; e utilizar a marca, o nome ou anúncios pagos com o termo "Minha Anamnese" sem autorização expressa.',
      'A empresa poderá suspender ou cancelar a conta de afiliado e as comissões pendentes em caso de indício de fraude, abuso ou violação destes termos, bem como suspender, encerrar ou alterar as condições do programa a qualquer momento, com efeito sobre comissões futuras, preservando as comissões já aprovadas e fora do período de carência.',
      'A participação no programa não garante qualquer volume de conversões, ganhos mínimos ou resultado específico.',
    ],
  },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. Dados que Coletamos',
    paragraphs: [
      'Para o funcionamento da plataforma, coletamos dados de cadastro e perfil, como e-mail, nome, dados do plano escolhido e preferências de acesso, gerenciados através do Supabase.',
      'Também podemos armazenar dados de uso e histórico, incluindo histórico de anamneses, logs de uso, métricas de análise e templates criados pelo usuário em nosso banco de dados no Supabase.',
      'Informações de checkout, auditoria de pagamentos e eventos de faturamento são processados e gerenciados diretamente pelo Mercado Pago. Não armazenamos dados sensíveis de cartão de crédito em nossos servidores.',
    ],
  },
  {
    title: '2. Tratamento de Dados Médicos e Sanitização',
    paragraphs: [
      'O aplicativo processa dados de anamnese e interage com a inteligência artificial da OpenAI para organizar o texto, gerar cartas de encaminhamento e fornecer insights estruturais.',
      'Conforme nossos Termos de Uso, o usuário não deve inserir dados pessoais identificáveis de pacientes, como nome, CPF, endereço ou telefone.',
      'Ao seguir esta regra, os dados processados pelo sistema e enviados à API da OpenAI tornam-se informações clínicas anonimizadas, não configurando dados sensíveis atrelados a um indivíduo específico pela LGPD.',
    ],
  },
  {
    title: '3. Compartilhamento com Terceiros',
    paragraphs: [
      'Para que a plataforma funcione adequadamente, utilizamos serviços de terceiros essenciais para a nossa infraestrutura tecnológica.',
      'Supabase é utilizado para autenticação de usuários e hospedagem do banco de dados relacional.',
      'OpenAI é utilizada para processamento de linguagem natural, análise de texto estrutural e organização das anamneses.',
      'Mercado Pago é utilizado para processamento de pagamentos e gestão de assinaturas do plano profissional.',
      'Render e Vercel são utilizados para hospedagem da infraestrutura do backend e frontend.',
      'Notion é utilizado internamente como CMS editorial para sincronização de templates e guias, sem acesso aos dados gerados pelos usuários.',
    ],
  },
  {
    title: '4. Uso de Cookies',
    paragraphs: [
      'O Minha Anamnese utiliza cookies e tecnologias semelhantes para manter sua sessão de usuário ativa e segura, lembrar preferências de interface e templates, e monitorar métricas gerais de uso para melhorar a estabilidade e performance do site.',
      'Ao acessar a plataforma pela primeira vez, você poderá consentir com o uso de cookies não essenciais através do nosso banner de privacidade.',
      'Cookies essenciais, necessários para autenticação e funcionamento básico, permanecem ativos mesmo quando cookies não essenciais são recusados.',
    ],
  },
  {
    title: '5. Seus Direitos (LGPD)',
    paragraphs: [
      'Você possui o direito de solicitar acesso aos dados da sua conta, corrigir informações incorretas ou desatualizadas e solicitar a exclusão definitiva da sua conta e do seu histórico de anamneses armazenadas no banco de dados.',
      'Para exercer esses direitos, entre em contato conosco através do e-mail de suporte.',
    ],
  },
  {
    title: '6. Contato',
    paragraphs: [
      'Se tiver dúvidas sobre nossa Política de Privacidade ou Termos de Uso, entre em contato através de otavioogatti@gmail.com.',
    ],
  },
];

export const LEGAL_DOCUMENTS = {
  terms: {
    type: 'terms',
    title: 'Termos e Condições de Uso',
    eyebrow: 'Condições de uso',
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: TERMS_SECTIONS,
    intro: [
      'Bem-vindo(a) ao Minha Anamnese. Este documento estabelece as regras e condições para a utilização do nosso aplicativo web, desenvolvido para organizar anamneses médicas com apoio de IA, templates clínicos e guias de prescrição.',
      'Ao criar uma conta e utilizar o Minha Anamnese, você concorda expressamente com os termos descritos abaixo.',
    ],
  },
  privacy: {
    type: 'privacy',
    title: 'Política de Privacidade',
    eyebrow: 'Privacidade e LGPD',
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: PRIVACY_SECTIONS,
    intro: [
      'A sua privacidade é fundamental para nós. Esta Política de Privacidade explica como o Minha Anamnese coleta, utiliza, compartilha e protege as suas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD).',
    ],
  },
};

function LegalDocumentPage({ type = 'terms' }) {
  const document = LEGAL_DOCUMENTS[type] || LEGAL_DOCUMENTS.terms;

  return (
    <main className="legal-page">
      <header className="legal-header">
        <a className="legal-brand" href="/">
          <span className="legal-brand-mark" aria-hidden="true">MA</span>
          <span>
            <strong>Minha Anamnese</strong>
            <small>Workspace clínico inteligente</small>
          </span>
        </a>

        <nav className="legal-nav" aria-label="Documentos legais">
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/">Voltar ao app</a>
        </nav>
      </header>

      <section className="legal-hero">
        <span className="workspace-kicker">{document.eyebrow}</span>
        <h1>{document.title}</h1>
        <p>Última atualização: {document.lastUpdated}</p>
      </section>

      <article className="legal-document">
        {document.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {document.sections.map((section) => (
          <section key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}

export default LegalDocumentPage;
