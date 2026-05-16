# Minha Anamnese

Aplicativo web para organizar anamneses médicas com apoio de inteligência artificial, templates clínicos e recursos profissionais para revisão, evolução e documentação complementar.

## Funcionalidades

- Organização de anamneses com IA a partir de templates clínicos
- Templates oficiais para Psiquiatria, Pediatria, Clínica Médica, Obstetrícia, Urgência e Emergência, Puerpério, Ginecologia e Triagem
- Biblioteca de templates próprios para usuários do plano profissional
- Avaliação estrutural da anamnese com pontuação, lacunas e acompanhamento de evolução
- Cartas de encaminhamento geradas com IA
- Guias de prescrição por patologia
- Autenticação de usuários com confirmação por e-mail
- Perfis com controle de plano, período de teste e preferências
- Checkout e liberação de acesso profissional
- Interface responsiva voltada para uso clínico no dia a dia

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Banco e autenticação: Supabase
- IA: OpenAI
- Pagamentos: Mercado Pago
- Deploy: Vercel

## Requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Chave de API da OpenAI
- Projeto Supabase configurado
- Credenciais do Mercado Pago para checkout

## Como Rodar

### 1. Configurar o Backend

```bash
cd backend
copy .env.example .env
npm install
npm start
```

Preencha as variáveis de ambiente necessárias antes de iniciar o servidor, incluindo credenciais de OpenAI, Supabase e Mercado Pago.

Backend local: `http://localhost:3001`

### 2. Configurar o Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://localhost:3000`

### 3. Usar

1. Abra `http://localhost:3000`
2. Crie uma conta ou entre com seu e-mail
3. Escolha um template clínico
4. Cole as anotações da consulta
5. Clique em **Organizar Anamnese**

## Estrutura do Produto

- **Home:** organização da anamnese, score estrutural, insights e encaminhamento
- **Templates:** biblioteca oficial e templates personalizados
- **Evolução:** métricas e histórico recente de desempenho
- **Guias de Prescrição:** protocolos clínicos por patologia
- **Perfil:** plano, período de teste, preferências e informações da conta

## Persistência e Privacidade

- O produto armazena dados de conta, plano, preferências, métricas de uso e histórico agregado de evolução
- O texto clínico não deve ser usado como prontuário oficial
- Evite inserir dados identificáveis do paciente, como nome, CPF, endereço ou outros dados sensíveis

## Roadmap

- [x] Autenticação de usuários
- [x] Sistema de assinatura e pagamento
- [x] Histórico e evolução de anamneses
- [x] Templates clínicos adicionais
- [x] Deploy em produção
- [ ] Exportação para PDF
- [ ] Testes automatizados de regressão
- [ ] Controles avançados de privacidade e gestão de conta

## Aviso

> Não insira dados sensíveis identificáveis do paciente. Utilize apenas informações clínicas necessárias para apoio à organização do registro.

## License

MIT
