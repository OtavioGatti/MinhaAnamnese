# Minha Anamnese

Aplicativo web para organização de anamneses médicas utilizando inteligência artificial (OpenAI).

## Funcionalidades

- 3 modelos de anamnese: **Psiquiatria**, **Pediatria** e **Clínica Médica**
- Processamento com IA (GPT-4o-mini)
- Interface limpa e responsiva
- Copiar resultado com um clique
- Sem armazenamento de dados (processamento em tempo real)

## Requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Uma [API Key da OpenAI](https://platform.openai.com/api-keys)

## Como Rodar

### 1. Configurar o Backend

```bash
cd backend
copy .env.example .env
# Edite .env e coloque sua OPENAI_API_KEY
npm install
npm start
```

Backend roda em `http://localhost:3001`.

### 2. Configurar o Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend roda em `http://localhost:3000`.

### 3. Usar

1. Abra `http://localhost:3000`
2. Selecione o modelo de anamnese
3. Cole suas anotações
4. Clique em **Organizar Anamnese**

## Roadmap

- [ ] Autenticação de usuários
- [ ] Sistema de assinatura/pagamento
- [ ] Dashboard com histórico de anamneses
- [ ] Exportar para PDF
- [ ] Mais templates médicos
- [ ] Deploy em produção

## Aviso

> Não insira dados sensíveis identificáveis (nome, CPF, endereço). Utilize apenas informações clínicas.

## License

MIT
