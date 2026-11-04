# Registro de Sessão e Decisões do Agente (ADR & Session Log)

Este documento funciona como a **memória persistente e agnóstica de ambiente** do projeto. Todo agente (seja no Antigravity, Claude Code, Cursor ou Codex) deve **ler este arquivo no início de cada interação** e **registrar suas decisões ao final de cada etapa**.

---

## 1. Estado Atual do Fluxo SDD (Spec-Driven Development)
- **Fase Atual:** `3 - Ambiente Configurado, Uso Ilimitado Ativo, Cache por Hash e Rate Limit Técnico Implementados`
- **Próximo Passo Recomendado:** O usuário pode acessar `http://localhost:5173` no navegador e enviar quantas fotos desejar seguidamente sem bloqueios diários.

### Checklist de Progresso Macro
- [x] **Fase 0:** Inicialização da estrutura SDD e mapeamento de Slash Commands (`/passo1`, `/passo2`, `/passo3`).
- [x] **Fase 1 (`/passo1`):** Levantamento de Regras de Negócio e aprovação do `docs/brd.md`.
- [x] **Fase 2 (`/passo2`):** Definição de Arquitetura, Stack e aprovação do `docs/trd.md`.
- [x] **Fase 3 (`/passo3`):** Configuração de ambiente local, implementação guiada pelas specs e testes.

---

## 2. Histórico de Decisões Arquiteturais e de Negócio (Log Cronológico)

### [2026-11-03] — Inicialização da Arquitetura Agêntica e Estrutura SDD
- **Papel Ativo:** Engenheiro de Software Sênior & Especialista em Arquitetura Agêntica
- **Contexto:** Fundação estruturada para seguir o método *Vibe Coding Sensato* e *Spec-Driven Development (SDD)*, garantindo compatibilidade total entre diferentes IDEs e harnesses agênticos.
- **Artefatos Modificados:**
  - `docs/contexto.md`, `docs/arquitetura.md`, `docs/brd.md`, `docs/trd.md`, `docs/sessao_agente.md`
  - `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursorrules`

### [2026-11-03] — Sabatina de Negócio e Consolidação do BRD (`/passo1`)
- **Papel Ativo:** Analista de Sistemas Experiente (`/passo1`)
- **Decisões de Negócio Validadas pelo Usuário:**
  1. **Acesso e Conta (`RF-001`):** Exigir criação de conta e identificação obrigatória do usuário para utilizar o aplicativo e manter o histórico completo de análises.
  2. **Entrada e Direcionamento (`RF-002`):** Permitir que o usuário envie uma foto acompanhada de preferências musicais opcionais (gêneros favoritos, idioma ou época musical).
  3. **Formato das Recomendações e Áudio (`RF-004`, `RF-005`, `RF-006`):** Exibir leitura do clima/emoção/contexto da foto e **3 a 5 músicas** recomendadas, cada uma com justificativa da escolha, reprodução individual de trecho sonoro (30s, uma por vez) e atalho para ouvir a faixa completa externamente.
  4. **Regra de Atenuação Sonora (`RF-006`):** Priorizar músicas com prévia de áudio disponível; caso uma música ideal não tenha prévia liberada, exibi-la normalmente com sua justificativa, aviso de prévia indisponível e atalho externo.
  5. **Histórico e Compartilhamento (`RF-008`, `RF-009`):** Salvar no histórico da conta a miniatura da foto, leitura de clima/emoção e músicas sugeridas (com permissão para o usuário excluir itens quando desejar) e permitir compartilhar um resumo visual ("card" com a foto e a música escolhida).
  6. **Instalação e Conectividade (`RF-010`):** Permitir instalar o aplicativo na tela inicial do aparelho; quando sem internet, exibir os resultados já consultados anteriormente e avisar que novas análises exigem conexão.

### [2026-11-03] — Definição da Arquitetura, Viabilidade Técnica e Consolidação do TRD (`/passo2`)
- **Papel Ativo:** Profissional Técnico de Arquitetura (`/passo2`)
- **Decisões Arquiteturais (ADRs) Definidas pelo Usuário:**
  1. **ADR-001 — Stack Tecnológica (`React Vite + Node/Express + Prisma + Neon PostgreSQL`).**
  2. **ADR-002 — Padrão de Arquitetura de Código e Pastas (`Camadas Tradicional / MVC-Like`).**
  3. **ADR-003 — Manipulação Visual, Áudio e Card Compartilhável (`Tailwind CSS + HTML5 Canvas API + Singleton Audio`).**
  4. **ADR-004 — Integrações Externas (`Google Gemini Multimodal API + iTunes/Deezer Public API + Fallback Mock`).**

### [2026-11-03] — Refatoração Visual ("Pôster / Zine Retrô")
- **Papel Ativo:** Engenheiro Sênior de Frontend & Design System (`/passo3`)
- **Contexto:** Redesenho da camada visual e componentização do frontend seguindo a referência gráfica "Pôster Retrô" (`Nº 01 · EDIÇÃO FOTO`).

### [2026-11-03] — Remoção do Limite de Uso Diário, Uso Ilimitado, Cache por Hash e Rate Limit Técnico
- **Papel Ativo:** Engenheiro Full-Stack Sênior (`/passo3`)
- **Contexto:** Atualização da arquitetura para permitir uso **ILIMITADO** de análises de fotos pelos usuários, removendo contadores diários e avisos de bloqueio no front-end e back-end, e adicionando proteção técnica contra abuso (`RATE_LIMIT_PER_MINUTE`) e redução de custo de IA (compressão client-side + cache SHA-256 por imagem + filtros).
- **Decisões e Alterações Implementadas:**
  1. **Front-end:** Removidos selos no cabeçalho, avisos de bloqueio, contadores no botão de análise/regeneração, estados e armazenamento local relacionados a limites diários. Adicionado debounce nos botões (`VITE_BUTTON_DEBOUNCE_MS`), compressão configurável (`VITE_IMAGE_MAX_DIMENSION`, `VITE_IMAGE_QUALITY`) e cálculo de hash SHA-256 da imagem + filtros.
  2. **Back-end:** Removidos os controladores, serviços, utilitários de meia-noite, rotas e campos do modelo `User` associados ao antigo limite operacional diário. Adicionado middleware `rate-limit.middleware.ts` configurável via `.env` (`RATE_LIMIT_PER_MINUTE=10`, `RATE_LIMIT_WINDOW_MS=60000`) com mensagem amigável (`"Calma, tente de novo em alguns segundos"`) e cache SHA-256 em `ai-vision.service.ts` e `analysis.service.ts` (`AI_CACHE_TTL_MS=3600000`).

### [2026-11-03] — Diagnóstico de IA Real vs Fallback Silencioso, Correção do Modelo Gemini e Transparência de Fallback
- **Papel Ativo:** Engenheiro Full-Stack Sênior (`/passo3`)
- **Contexto:** Diagnóstico empírico de por que `AiVisionService.analyzePhoto` estava retornando sempre as faixas de `CURATED_PROFILES` de forma silenciosa e implementação das correções de servidor, front-end e testes automatizados.
- **Diagnóstico e Alterações Implementadas:**
  1. **Causas Confirmadas no Diagnóstico:**
     - **Hipótese (a) confirmada:** A validação `apiKey.startsWith('AIza')` rejeitava a chave real válida do `.env` (`AQ.Ab8RN6J...`, 53 caracteres), pulando a chamada ao Gemini.
     - **Hipóteses (b) e (c) confirmadas:** O modelo `gemini-2.5-flash` retorna HTTP `404 NOT_FOUND` (`"This model models/gemini-2.5-flash is no longer available to new users"`), enquanto `gemini-3.1-flash-lite` retorna `200 OK` na chave configurada. O `catch` engolia o `404` silenciosamente caindo no fallback.
     - **Hipótese (f) confirmada:** Resultados de fallback eram salvos em `visionCache` e `enrichedAnalysisCache` durante todo o TTL (`14400s`), envenenando o cache.
     - **Hipótese (g) confirmada:** `generateDeterministicFallback` calculava o hash apenas sobre os primeiros 120 caracteres do Base64 (cabeçalho fixo do JPEG), caindo sempre no mesmo perfil.
  2. **Back-end (`ai-vision.service.ts`, `analysis.service.ts`, `resilience.util.ts`, `env.ts`, `server.ts`):**
     - Adicionado `GEMINI_MODEL="gemini-3.1-flash-lite"` configurável via `.env` e validação de modelo no startup (`validateModelOnStartup`).
     - Removida a trava `startsWith('AIza')`; adicionados `isFallback`, `fallbackReason` (`NO_API_KEY` | `RATE_LIMITED` | `UPSTREAM_ERROR` | `INVALID_AI_RESPONSE`) e `upstreamStatus`.
     - Proibido salvar resultados de fallback em `visionCache` e `enrichedAnalysisCache`.
     - Textos do fallback tornados neutros (`"Sugestões populares enquanto a análise da sua foto não está disponível."`), removida a faixa fictícia `"Sessão Acústica Secreta"` e desativadas todas as simulações quando `NODE_ENV === 'production'`.
  3. **Front-end (`HomeAnalysisPage.tsx`, `TopTrackCard.tsx`, `TrackListItem.tsx`, `types/index.ts`, `api.service.ts`):**
     - Banner visível quando `isFallback === true` com mensagem amigável por `fallbackReason`, botão `"TENTAR DE NOVO"` (`bypassCache: true`) e selo `"SUGESTÃO POPULAR"` nos cartões.
