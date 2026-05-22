const LAST_UPDATED = '22/05/2026';

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
      'Durante o trial, aplicam-se limites de uso para geração de insights, cartas de encaminhamento, guias de prescrição e templates de usuário.',
      'O processamento de pagamentos para a liberação do plano profissional e o checkout são realizados de forma segura pela integração com o Mercado Pago.',
      'Em caso de cancelamento da assinatura, o acesso às funcionalidades premium será suspenso ao final do ciclo de faturamento vigente.',
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

function LegalDocumentPage({ type = 'terms' }) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Política de Privacidade' : 'Termos e Condições de Uso';
  const eyebrow = isPrivacy ? 'Privacidade e LGPD' : 'Condições de uso';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

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
        <span className="workspace-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>Última atualização: {LAST_UPDATED}</p>
      </section>

      <article className="legal-document">
        {!isPrivacy && (
          <p>
            Bem-vindo(a) ao Minha Anamnese. Este documento estabelece as regras e condições para a utilização do nosso aplicativo web,
            desenvolvido para organizar anamneses médicas com apoio de IA, templates clínicos e guias de prescrição.
          </p>
        )}

        {!isPrivacy && (
          <p>
            Ao criar uma conta e utilizar o Minha Anamnese, você concorda expressamente com os termos descritos abaixo.
          </p>
        )}

        {isPrivacy && (
          <p>
            A sua privacidade é fundamental para nós. Esta Política de Privacidade explica como o Minha Anamnese coleta,
            utiliza, compartilha e protege as suas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
          </p>
        )}

        {sections.map((section) => (
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
