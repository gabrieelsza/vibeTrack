# Diretrizes Universais de Arquitetura Agêntica (Vibe Coding Sensato & SDD)

Este repositório utiliza **Spec-Driven Development (SDD)** e **Vibe Coding Sensato** com uma arquitetura totalmente **agnóstica a ambientes e harnesses** (compatível nativamente com **Antigravity**, **Claude Code**, **Cursor** e **Codex**).

---

## 1. Fonte Única da Verdade (Single Source of Truth)
Toda a memória, contexto, requisitos e decisões do projeto residem em `/docs`:

- [`docs/contexto.md`](./docs/contexto.md): Objetivo geral, personas, glossário de domínio e escopo do projeto (In-Scope vs. Out-of-Scope).
- [`docs/arquitetura.md`](./docs/arquitetura.md): Diretrizes gerais de tecnologia, stack escolhida, padrões de projeto e requisitos não-funcionais globais.
- [`docs/brd.md`](./docs/brd.md): **Business Requirement Document** — Matriz de requisitos funcionais (`RF-XXX`), regras de negócio, fluxos de usuário e critérios de aceite.
- [`docs/trd.md`](./docs/trd.md): **Technical Requirement Document** — Matriz de rastreabilidade técnica (`RT-XXX` -> `RF-XXX`), schema de banco de dados, contratos de API e plano sequencial de tasks.
- [`docs/sessao_agente.md`](./docs/sessao_agente.md): **Memória Persistente e ADR Log** — Registro cronológico de todas as decisões tomadas pelos agentes entre sessões.

---

## 2. Regra de Ouro do Fluxo SDD (Spec-First)
> **NENHUM CÓDIGO DE APLICAÇÃO DEVE SER GERADO ANTES DA CONCLUSÃO E APROVAÇÃO DOS PASSOS DE ANÁLISE (`/passo1` E `/passo2`).**

1. **Início de Sessão:** Sempre leia `docs/sessao_agente.md` primeiro para identificar em qual fase o projeto se encontra.
2. **Fim de Sessão / Etapa:** Sempre atualize `docs/sessao_agente.md` registrando as decisões tomadas e os arquivos alterados.

---

## 3. Mapeamento Universal de Comandos e Skills (`/passo1`, `/passo2`, `/passo3`)

Independentemente do harness utilizado (Antigravity, Claude Code, Cursor ou Codex), sempre que o usuário invocar um dos atalhos abaixo (via Slash Command nativo ou texto direto no chat), carregue e siga estritamente a respectiva Skill canônica:

| Comando | Papel Especializado | Fonte Canônica da Skill | Artefatos Alvo |
| :--- | :--- | :--- | :--- |
| **`/passo1`** | **Analista de Sistemas Experiente** (foco exclusivo em levantamento de regras de negócio, escopo e geração do BRD; **proibido gerar código**) | [`.agents/skills/passo1/SKILL.md`](./.agents/skills/passo1/SKILL.md) | `docs/contexto.md`, `docs/brd.md`, `docs/sessao_agente.md` |
| **`/passo2`** | **Profissional Técnico de Arquitetura** (foco exclusivo em viabilidade técnica, escolhas de stack e geração do TRD; **proibido gerar código**) | [`.agents/skills/passo2/SKILL.md`](./.agents/skills/passo2/SKILL.md) | `docs/arquitetura.md`, `docs/trd.md`, `docs/sessao_agente.md` |
| **`/passo3`** | **Configuração de Ambiente e Codificação** (foco em criar ambiente de teste local, subir servidores, implementar código fiel ao TRD e validar critérios do BRD) | [`.agents/skills/passo3/SKILL.md`](./.agents/skills/passo3/SKILL.md) | Código da aplicação, testes locais, `docs/trd.md`, `docs/sessao_agente.md` |

---

## 4. Compatibilidade Multi-Harness Configurada
- **Antigravity:** Lê `GEMINI.md` / `AGENTS.md`, descobre as skills em `.agents/skills/*/SKILL.md` e os workflows em `.agents/workflows/passo{1,2,3}.md`.
- **Claude Code:** Lê `CLAUDE.md` / `AGENTS.md` e expõe os comandos `/passo1`, `/passo2`, `/passo3` via `.claude/commands/passo{1,2,3}.md`.
- **Cursor:** Lê `.cursorrules` / `AGENTS.md` e expõe os comandos `/passo1`, `/passo2`, `/passo3` via `.cursor/commands/passo{1,2,3}.md`.
- **OpenAI Codex:** Lê `AGENTS.md` na raiz e executa as skills canônicas em `.agents/skills/passo{1,2,3}/SKILL.md`.
