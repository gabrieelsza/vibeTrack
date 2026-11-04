# 🎧 VibeTrack

> Transforme o clima de uma foto em trilha sonora.

O **VibeTrack** é um aplicativo instalável (PWA) que analisa fotografias com inteligência artificial — identificando clima, emoções, estética e contexto visual — e recomenda de **3 a 5 músicas** que combinam com o momento retratado, explicando o motivo de cada escolha e permitindo ouvir um trecho na hora.

🔗 **Demo (frontend):** `https://frontend-six-sandy-45.vercel.app/`
🔗 **API (backend):** `https://vibetrack-cgro.onrender.com/`

---

## 📑 Sumário

- [Visão geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Fora do escopo do MVP](#-fora-do-escopo-do-mvp)
- [Arquitetura](#-arquitetura)
- [Tecnologias](#-tecnologias)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Como rodar localmente](#-como-rodar-localmente)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Deploy](#-deploy)
  - [Backend na Render](#1-backend-na-render)
  - [Frontend na Vercel](#2-frontend-na-vercel)
  - [Checklist pós-deploy](#3-checklist-pós-deploy)
- [Regras de negócio](#-regras-de-negócio)
- [Glossário](#-glossário)
- [Solução de problemas](#-solução-de-problemas)
- [Roadmap](#-roadmap)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 🎯 Visão geral

**Problema:** quem compartilha fotos perde tempo procurando uma música que combine com a estética e a emoção da imagem antes de publicar.

**Solução:** o usuário envia uma foto, o VibeTrack lê a "vibe" (atmosfera emocional, cenário, iluminação, elementos predominantes) e devolve recomendações justificadas, com prévia de áudio e atalho para ouvir a faixa completa em serviços externos.

### Personas

| Persona | Necessidade |
| :--- | :--- |
| **Criador de conteúdo / usuário social** | Sugestões justificadas e um cartão visual pronto para compartilhar. |
| **Entusiasta de música e memórias** | Descobrir faixas alinhadas ao seu gosto (gênero, idioma, época), ouvir uma prévia e consultar o histórico depois. |

---

## ✨ Funcionalidades

- **Conta e identificação obrigatória** — cadastro/login para vincular o histórico ao usuário.
- **Envio de foto + preferências opcionais** — gênero musical, idioma ou época antes da análise.
- **Análise inteligente da imagem** — extração de clima, emoção e contexto.
- **Recomendação de 3 a 5 músicas** com título, artista, capa do álbum, justificativa personalizada, player de prévia (uma faixa por vez) e link para audição completa.
- **Atenuação de prévia indisponível** — músicas sem trecho liberado continuam sendo exibidas, com aviso discreto e link externo.
- **Novas sugestões ilimitadas** para a mesma foto.
- **Uso ilimitado com proteção técnica** — compressão de imagem, cache por hash (foto + filtros) e rate limit por minuto no servidor.
- **Histórico completo** — miniatura, leitura da vibe e músicas recomendadas; consulta offline dos itens já sincronizados e exclusão pelo usuário.
- **Card compartilhável** — imagem combinando a foto e a música escolhida para redes sociais e mensageiros.
- **Instalável e com suporte offline parcial** — adicione à tela inicial; sem internet, o histórico sincronizado continua acessível e o app avisa que novas análises exigem conexão.

---

## 🚫 Fora do escopo do MVP

- Uso anônimo (sem conta)
- Reprodução de músicas completas dentro do app (apenas prévias)
- Edição avançada de imagem e filtros visuais
- Envio/análise de vídeos ou lotes de arquivos
- Rede social interna (feed, comentários, seguidores)

---

## 🏗 Arquitetura

```
┌──────────────────────┐        HTTPS        ┌───────────────────────────┐
│  Frontend (PWA)      │ ──────────────────► │  Backend (API REST)       │
│  Hospedado na Vercel │ ◄────────────────── │  Hospedado na Render      │
└──────────────────────┘                     └─────────────┬─────────────┘
                                                           │
                         ┌─────────────────────────────────┼─────────────────────┐
                         ▼                                 ▼                     ▼
                ┌─────────────────┐            ┌────────────────────┐   ┌──────────────────┐
                │ Serviço de IA   │            │ Catálogo musical   │   │ Banco de dados   │
                │ (visão + texto) │            │ (metadados/prévia) │   │ (usuários/histór.)│
                └─────────────────┘            └────────────────────┘   └──────────────────┘
```

**Fluxo de uma análise:**

1. O usuário autenticado seleciona uma foto (e, opcionalmente, preferências).
2. O app comprime a imagem e envia para a API.
3. A API calcula o hash (foto + filtros) e consulta o **cache**; em caso de *hit*, retorna o resultado salvo.
4. Em *miss*, a IA interpreta a imagem e sugere músicas; o catálogo externo enriquece cada faixa (capa, prévia, link).
5. O resultado é salvo no histórico e devolvido ao app.

---

## 🧰 Tecnologias

> Ajuste esta seção conforme a stack final do projeto.

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | React, TypeScript, Tailwind CSS, Vite, PWA (service worker + manifest) |
| Backend | Node.js, Express, TypeScript |
| Banco de dados | PostgreSQL |
| IA | Provedor de IA com visão computacional (via API) |
| Catálogo musical | API externa de música (metadados, capas e prévias de ~30s) |
| Deploy | **Vercel** (frontend) e **Render** (backend) |

---

## 📁 Estrutura de pastas

```
vibetrack/
├── frontend/              # Aplicação React (PWA)
│   ├── public/            # manifest.webmanifest, ícones
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/      # chamadas à API
│   │   └── sw.ts          # service worker
│   ├── .env.example
│   └── package.json
├── backend/               # API Express
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/      # IA, catálogo musical, cache
│   │   ├── middlewares/   # auth, rate limit
│   │   └── server.ts
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## 💻 Como rodar localmente

### Pré-requisitos

- Node.js 20+
- npm ou pnpm
- Git
- Chaves de acesso do serviço de IA e do catálogo musical
- Banco de dados acessível (local ou em nuvem)

### 1. Clonar o repositório

```bash
git clone https://github.com/gabrieelsza/vibeTrack.git
cd vibeTrack
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # preencha as variáveis
npm install
npm run dev               # http://localhost:8550
```

### 3. Frontend

```bash
cd ../frontend
cp .env.example .env      # preencha as variáveis
npm install
npm run dev               # http://localhost:5173
```

### Scripts úteis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Executa o build (backend) |
| `npm run lint` | Verifica o código |

---

## 🔐 Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `PORT` | Porta do servidor (a Render injeta automaticamente) | `8550` |
| `NODE_ENV` | Ambiente | `production` |
| `DATABASE_URL` | String de conexão do banco | `postgresql://...` |
| `JWT_SECRET` | Segredo para assinar tokens de sessão | `uma-string-longa-e-aleatoria` |
| `AI_API_KEY` | Chave do serviço de IA | `sk-...` |
| `MUSIC_API_KEY` | Chave/credenciais do catálogo musical | `...` |
| `RATE_LIMIT_PER_MINUTE` | Máximo de requisições por minuto por usuário/IP | `10` |
| `CORS_ORIGIN` | URL do frontend permitida | `https://SEU-PROJETO.vercel.app` |

### Frontend (`frontend/.env`)

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `VITE_API_URL` | URL base da API | `https://vibeTrack-cgro.onrender.com` |

> ⚠️ **Nunca** faça commit de arquivos `.env`. Mantenha apenas o `.env.example` no repositório. Variáveis `VITE_*` ficam expostas no navegador — não coloque segredos nelas.

---

## 🚀 Deploy

O projeto usa **Render** para o backend e **Vercel** para o frontend. Faça o deploy nesta ordem: **backend primeiro**, depois frontend.

### 1. Backend na Render

1. Acesse [render.com](https://render.com) e crie uma conta (pode entrar com o GitHub).
2. Clique em **New +** → **Web Service** e conecte o repositório.
3. Configure:

   | Campo | Valor |
   | :--- | :--- |
   | **Name** | `vibetrack-api` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` (para testes) |

4. Em **Environment**, adicione todas as variáveis do backend (veja a tabela acima). Em `CORS_ORIGIN`, use por enquanto `*` ou a URL provisória e atualize depois com a URL da Vercel.
5. Se usar banco gerenciado, crie-o em **New +** → **PostgreSQL** e cole a *Internal Database URL* em `DATABASE_URL`.
6. Clique em **Create Web Service** e aguarde o build.
7. Teste a rota de saúde: `https://SEU-PROJETO.onrender.com/health`.

> 💡 **Plano gratuito da Render:** o serviço "dorme" após alguns minutos sem tráfego, e a primeira requisição depois disso pode demorar. Para uso real, considere um plano pago ou um serviço de *keep-alive*.

**Opcional — Infraestrutura como código (`render.yaml` na raiz):**

```yaml
services:
  - type: web
    name: vibetrack-api
    runtime: node
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: RATE_LIMIT_PER_MINUTE
        value: "10"
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        sync: false
      - key: AI_API_KEY
        sync: false
      - key: MUSIC_API_KEY
        sync: false
      - key: CORS_ORIGIN
        sync: false
```

### 2. Frontend na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com o GitHub.
2. Clique em **Add New…** → **Project** e importe o repositório.
3. Configure:

   | Campo | Valor |
   | :--- | :--- |
   | **Framework Preset** | `Vite` |
   | **Root Directory** | `frontend` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

4. Em **Environment Variables**, adicione:
   - `VITE_API_URL` = `https://SEU-PROJETO.onrender.com`
5. Clique em **Deploy**.
6. Copie a URL gerada e **volte à Render** para atualizar `CORS_ORIGIN` com ela.

**Roteamento SPA — `frontend/vercel.json`:**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> Sem esse arquivo, recarregar a página em rotas internas (ex.: `/historico`) retorna 404.

### 3. Checklist pós-deploy

- [ ] `GET /health` na API responde `200`
- [ ] `CORS_ORIGIN` na Render aponta para a URL exata da Vercel (sem barra final)
- [ ] Cadastro e login funcionam em produção
- [ ] Upload de foto e recomendações funcionam
- [ ] Prévia de áudio toca e pausa ao iniciar outra faixa
- [ ] O app é instalável (HTTPS + manifest + service worker)
- [ ] Histórico abre sem internet após sincronizado
- [ ] Rate limit responde `429` ao exceder o limite
- [ ] Nenhuma chave secreta exposta no bundle do frontend

### Deploy contínuo

Ambas as plataformas fazem deploy automático a cada `push` na branch `main`. Pull requests geram *preview deployments* na Vercel.

---

## 📐 Regras de negócio

- Todo usuário precisa estar identificado para analisar fotos e acessar o histórico.
- O uso é **ilimitado**, protegido por cache por hash e por rate limit por minuto (`RATE_LIMIT_PER_MINUTE`).
- Cada análise retorna de **3 a 5** músicas.
- Apenas **uma prévia** toca por vez; iniciar outra pausa a anterior.
- Músicas sem prévia liberada continuam sendo exibidas, com justificativa, aviso visual discreto e link externo.
- Novas análises e novas sugestões **exigem internet**; o histórico já sincronizado funciona offline.
- O usuário pode excluir seus registros do histórico.

---

## 📖 Glossário

| Termo | Definição |
| :--- | :--- |
| **Vibe** | Conjunto de características emocionais, estéticas, de iluminação, ambiente e sentimento identificados na foto. |
| **Análise de Foto** | Fluxo completo: envio da imagem (com ou sem preferências) e recebimento da vibe + 3 a 5 recomendações. |
| **Rate Limit** | Controle técnico no servidor que evita spam sem impor travas visuais ao uso normal. |
| **Prévia (Trecho Sonoro)** | Amostra de ~30 segundos da música recomendada. |
| **Atenuação de Prévia Indisponível** | Contingência que exibe a música mesmo sem prévia, com justificativa e link externo. |
| **Card Compartilhável** | Imagem com a foto, o clima detectado e a música escolhida, pronta para compartilhar. |

---

## 🛠 Solução de problemas

| Sintoma | Causa provável | Solução |
| :--- | :--- | :--- |
| Erro de CORS no navegador | `CORS_ORIGIN` incorreto | Use a URL exata da Vercel, sem barra no final, e faça redeploy do backend. |
| Primeira requisição muito lenta | Serviço gratuito da Render "dormindo" | Aguarde o *cold start* ou use um plano pago. |
| 404 ao recarregar uma rota | Falta o rewrite de SPA | Adicione o `vercel.json` mostrado acima. |
| Frontend chama `localhost` em produção | `VITE_API_URL` não definida na Vercel | Defina a variável e faça **Redeploy** (variáveis `VITE_*` são embutidas no build). |
| App não aparece como instalável | Falta HTTPS, manifest ou service worker | Verifique a aba *Application* do DevTools / Lighthouse. |
| Erro `429 Too Many Requests` | Rate limit atingido | Aguarde um minuto ou ajuste `RATE_LIMIT_PER_MINUTE`. |
| Faixa sem player de áudio | Prévia não liberada pelo catálogo | Comportamento esperado; use o link externo. |

---

## 🗺 Roadmap

- [ ] Modo anônimo limitado
- [ ] Integração com playlists em serviços de streaming
- [ ] Filtros e edição leve de imagem
- [ ] Análise de vídeos curtos
- [ ] Mais modelos de *cards* compartilháveis

---

## 🤝 Contribuindo

1. Faça um *fork* do projeto
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Commit: `git commit -m "feat: minha feature"`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

Sugerimos o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/).

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

Feito com 🎶 e muita vibe.

criado por #`Gabriel Souza`
