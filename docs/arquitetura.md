# Diretrizes de Arquitetura e Tecnologia — VibeTrack

> **Status do Documento:** `APROVADO E IMPLEMENTADO (FASE 3)`  
> **Responsável:** Skill de Profissional Técnico de Arquitetura (`/passo2`)  
> **Última Atualização:** 2026-11-03

---

## 1. Princípios Arquiteturais (Vibe Coding Sensato & SDD)
1. **Spec-First (Especificação antes do Código):** Nenhuma linha de código de aplicação é escrita sem antes consolidar o **BRD** (`docs/brd.md`) e o **TRD** (`docs/trd.md`).
2. **Agnosticismo de Harness e Ambiente:** Toda a documentação de contexto, decisões e especificações reside em Markdown puro versionado em `/docs`, legível por humanos e por qualquer agente (Antigravity, Claude Code, Cursor, Codex).
3. **Execução Sem Dependências Locais Pesadas:** O projeto utiliza **Neon (Serverless PostgreSQL)** via string de conexão na nuvem aliado ao **Prisma ORM**, eliminando a necessidade de instalar ou configurar servidores PostgreSQL ou containers Docker localmente.
4. **Arquitetura em Camadas Tradicional (MVC-Like):** Separação clara e intuitiva por responsabilidade técnica (`/controllers`, `/services`, `/repositories`, `/middlewares` no Backend; `/components`, `/pages`, `/services`, `/contexts`, `/hooks` no Frontend).
5. **Rastreabilidade Total:** Cada decisão arquitetural está vinculada aos requisitos de negócio (`RF-001` a `RF-010`) e registrada em `docs/sessao_agente.md`.

---

## 2. Stack Tecnológica Definida

| Camada | Tecnologia / Framework Escolhido | Justificativa Técnica (Prós e Viabilidade) |
| :--- | :--- | :--- |
| **Frontend (SPA & PWA)** | **React 18+ com Vite + TypeScript + Tailwind CSS** | Inicialização instantânea (HMR rápido), tipagem estática, estilização responsiva mobile-first via utilitários Tailwind e suporte nativo a PWA (`vite-plugin-pwa`) para instalação na tela inicial (`RF-010`). |
| **Manipulação Visual & Áudio (Client)** | **HTML5 Canvas API Nativa + Web Audio / `HTMLAudioElement` Centralizado** | Geração determinística do *Card Compartilhável* em PNG (`RF-009`) sem bibliotecas pesadas de captura de DOM que falham no mobile, e controle *single-instance* de reprodução de prévias de 30s (`RF-006`). |
| **Backend / API REST** | **Node.js + Express + TypeScript** | Ecossistema maduro, leve e desacoplado do frontend, estruturado no padrão tradicional em camadas (Routes -> Controllers -> Services -> Repositories) com validação de payloads via **Zod** e rate limit configurável (`RATE_LIMIT_PER_MINUTE`). |
| **Banco de Dados & ORM** | **PostgreSQL (Neon Serverless) + Prisma ORM** | Banco relacional gerenciado na nuvem (zero instalação local de SGBD), tipagem automática gerada pelo Prisma Client e persistência do histórico (`RF-008`). |
| **Autenticação & Segurança** | **JWT (Stateless) + `bcryptjs` + Helmet/CORS + Rate Limit Middleware** | Autenticação obrigatória (`RF-001`) baseada em token assinado, senhas com hash seguro, proteção de rotas via middleware Express e proteção contra spam por usuário/IP (`RF-003`). |
| **Inteligência Artificial (Visão + Curadoria + Cache)** | **Google Gemini Multimodal API (`@google/genai` - `gemini-2.5-flash`) + Cache SHA-256 + Modo Fallback/Mock** | Capacidade nativa de analisar a fotografia enviada, extrair clima/emoção/contexto (`RF-004`) e retornar JSON estritamente tipado (`responseSchema`) com 3 a 5 músicas e justificativas (`RF-005`). Inclui cache por hash da imagem + filtros para redução de custo da IA. |
| **Catálogo Musical & Prévias 30s** | **iTunes Search API / Deezer Public API (Zero-Auth)** | Consulta pública e gratuita (sem exigir fluxo OAuth complexo do usuário final) para enriquecer cada recomendação da IA com capa de álbum real, URL de trecho sonoro MP3/M4A de 30s (`previewUrl`) e link de audição externa (`RF-006`). |
| **Testes & Qualidade (QA)** | **Vitest + Supertest + TypeScript (`tsc --noEmit`)** | Execução rápida de testes unitários e de integração das regras críticas (uso ilimitado, cache por hash de imagem+filtros, rate limit por minuto, atenuação de prévia ausente e exclusão de histórico). |

---

## 3. Padrões de Projeto e Organização de Pastas (Arquitetura em Camadas / MVC-Like)

```text
vibeTrack-SDD/
├── docs/                           # Fonte Única da Verdade (SDD: contexto, brd, arquitetura, trd, sessao_agente)
├── backend/                        # Servidor Node.js + Express + Prisma (Neon PostgreSQL)
│   ├── prisma/
│   │   └── schema.prisma           # Esquema físico do banco PostgreSQL (Neon) e modelos Prisma
│   ├── src/
│   │   ├── config/                 # Variáveis de ambiente (env.ts) e cliente Prisma
│   │   ├── controllers/            # Recepção de Request HTTP, validação de entrada e retorno de Response
│   │   │   ├── auth.controller.ts
│   │   │   └── analysis.controller.ts
│   │   ├── services/               # Regras de negócio, orquestração de IA com cache SHA-256 e catálogo musical
│   │   │   ├── auth.service.ts
│   │   │   ├── analysis.service.ts
│   │   │   ├── ai-vision.service.ts
│   │   │   └── music-catalog.service.ts
│   │   ├── repositories/           # Acesso a dados isolado via Prisma Client / Local Store
│   │   │   ├── user.repository.ts
│   │   │   └── analysis.repository.ts
│   │   ├── middlewares/            # Autenticação JWT, rate limit por minuto e tratamento global de erros
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── routes/                 # Definição das rotas Express (/api/v1/*)
│   │   │   └── index.ts
│   │   ├── utils/                  # Utilitários de erro e persistência local
│   │   ├── app.ts                  # Configuração da instância Express (CORS, JSON limit, rotas)
│   │   └── server.ts               # Bootstrap do servidor HTTP
│   ├── tests/                      # Testes automatizados de serviços e rotas (Vitest + Supertest)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                       # Aplicação Cliente React + Vite + Tailwind CSS (PWA)
    ├── public/
    │   ├── manifest.webmanifest    # Manifesto PWA para instalação na tela inicial (RF-010)
    │   └── icons/                  # Ícones do aplicativo instalável
    ├── src/
    │   ├── components/             # Componentes visuais reutilizáveis e de domínio
    │   │   ├── Layout/             # Navbar, OfflineBanner (RF-010)
    │   │   ├── Poster/             # Header, TitleHero, PolaroidPhoto, TopTrackCard, TrackListItem, PrimaryPillButton
    │   │   ├── Results/            # TrackItem (RF-005, RF-006)
    │   │   └── Share/              # ShareCardModal (renderização via HTML5 Canvas API - RF-009)
    │   ├── contexts/               # Gerenciamento de estado global leve (React Context API)
    │   │   ├── AuthContext.tsx     # Sessão do usuário e persistência do JWT
    │   │   ├── AudioPlayerContext.tsx # Singleton de áudio (garante 1 música por vez - RF-006)
    │   │   └── NetworkContext.tsx  # Detecção reativa de status online/offline (RF-010)
    │   ├── pages/                  # Telas principais da aplicação
    │   │   ├── AuthPage.tsx        # Login e Cadastro obrigatório (RF-001)
    │   │   ├── HomeAnalysisPage.tsx # Upload de foto com debounce, preferências, resultado e regeneração (RF-002 a RF-007)
    │   │   └── HistoryPage.tsx     # Histórico sincronizado + cache offline e exclusão (RF-008, RF-010)
    │   ├── services/               # Cliente HTTP, sincronização de cache local e compressão/hash de imagem
    │   │   ├── api.service.ts
    │   │   ├── offline-cache.service.ts
    │   │   └── image-compressor.service.ts
    │   ├── types/                  # Interfaces TypeScript espelhadas dos contratos da API
    │   ├── App.tsx
    │   └── main.tsx
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 4. Estratégia de Manipulação de Elementos na Tela e Renderização Visual

1. **Compressão, Redimensionamento e Hash de Imagem (`image-compressor.service.ts`):**
   - Ao selecionar uma foto (`RF-002`), o frontend valida o MIME type (`image/jpeg`, `image/png`, `image/webp`) e utiliza um `<canvas>` invisível em memória para redimensionar e comprimir a imagem (`VITE_IMAGE_MAX_DIMENSION=800`, `VITE_IMAGE_QUALITY=0.8`), além de calcular o hash SHA-256 da imagem + filtros para evitar reanálises repetidas da mesma foto.
2. **Controle Sonoro Centralizado (`AudioPlayerContext.tsx`):**
   - Uma única instância de `HTMLAudioElement` é mantida no contexto raiz do React. Quando o usuário clica em *Play* na faixa $B$ enquanto a faixa $A$ está tocando, o contexto executa `audio.pause()`, substitui o `audio.src` pela URL da faixa $B$ e inicia a reprodução (`RF-006`).
3. **Geração Nativa do Card Compartilhável via HTML5 Canvas (`ShareCardModal.tsx`):**
   - Utiliza a API nativa `CanvasRenderingContext2D` (`1080x1350`) para desenhar o pôster retrô e exportar em PNG.
4. **Resiliência Offline e PWA (`NetworkContext.tsx` + `offline-cache.service.ts`):**
   - Sincroniza o histórico do usuário localmente para consulta mesmo sem internet (`RF-010`).

---

## 5. Requisitos Não-Funcionais Globais
- **Performance e Economia de IA:** Compressão client-side da imagem antes do upload e cache em memória por hash SHA-256 (`imagem + filtros`), evitando chamadas duplicadas para a mesma foto.
- **Segurança e Anti-Spam:** Senhas armazenadas com hash `bcrypt` (salt rounds >= 10); autenticação via `Bearer JWT`; validação com `zod`; debounce nos botões de ação e rate limit técnico por minuto (`RATE_LIMIT_PER_MINUTE`) no servidor.
- **Portabilidade e Simplicidade:** Execução completa apenas com Node.js (`npm run dev` no backend e frontend).
