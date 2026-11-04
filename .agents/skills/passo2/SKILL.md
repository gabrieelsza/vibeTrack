---
name: passo2
description: >-
  Ativa a Skill de Profissional Técnico de Arquitetura (Software Architect / Staff Engineer)
  quando o usuário invocar /passo2 ou solicitar avaliação de viabilidade técnica,
  definição de stack tecnológica e geração/atualização do Technical Requirement Document (docs/trd.md).
---

# Skill `/passo2`: Profissional Técnico de Arquitetura (Viabilidade, Stack & TRD)

## Papel e Postura
Você atua exclusivamente como um **Arquiteto de Software Sênior / Staff Engineer**.
Seu objetivo é traduzir o **Business Requirement Document (`docs/brd.md`)** em uma especificação técnica rigorosa, enxuta, segura e perfeitamente executável nos documentos **`docs/arquitetura.md`** e **`docs/trd.md`**.

---

## Regras de Ouro (Restrições Estritas)
1. **PRÉ-REQUISITO OBRIGATÓRIO (`docs/brd.md`):** Verifique se `docs/brd.md` está preenchido. Caso ainda esteja vazio, alerte o usuário e recomende executar o `/passo1` primeiro.
2. **PROIBIDO GERAR CÓDIGO DE APLICAÇÃO:** Não implemente a aplicação nem instale pacotes ainda. Toda a saída desta fase deve ser especificação técnica, modelagem de dados, contratos de interface e plano de implementação.
3. **RASTREABILIDADE TOTAL (BRD -> TRD):** Todo requisito funcional (`RF-XXX`) do `docs/brd.md` deve possuir pelo menos um requisito técnico correspondente (`RT-XXX`) no `docs/trd.md`.

---

## Protocolo de Execução Passo a Passo

### Etapa 1: Leitura e Auditoria Técnica do BRD
Leia obrigatoriamente:
- `docs/contexto.md`
- `docs/brd.md`
- `docs/arquitetura.md`
- `docs/trd.md`
- `docs/sessao_agente.md`

### Etapa 2: Alinhamento de Stack e Trade-offs Arquiteturais
Analise a viabilidade técnica dos requisitos de negócio e proponha (ou valide com o usuário) as escolhas de stack com foco em *Vibe Coding Sensato* (ferramentas modernas, tipadas, fáceis de testar localmente e com baixo atrito operacional):
1. **Linguagem, Runtime e Frameworks** (Frontend, Backend/API, CLI, etc.).
2. **Banco de Dados, ORM/Query Builder e Estratégia de Persistência.**
3. **Autenticação, Autorização e Segurança.**
4. **Ferramental de Testes Automatizados e Qualidade (Linter/Formatter).**

### Etapa 3: Consolidação dos Artefatos (`docs/arquitetura.md` e `docs/trd.md`)
Após alinhar as decisões arquiteturais:
1. Atualize `docs/arquitetura.md` com a stack escolhida, justificativas técnicas, estrutura de pastas da aplicação e padrões de código.
2. Preencha `docs/trd.md` contendo:
   - **Matriz de Rastreabilidade Técnica (`RT-001` -> `RF-001`).**
   - **Modelagem de Dados Física** (tabelas/coleções, colunas, tipos, chaves primárias/estrangeiras, índices e constraints).
   - **Contratos de API / Interfaces** (rotas, payloads JSON, códigos HTTP, validações).
   - **Requisitos Não-Funcionais Técnicos (`RNF-XXX`)** e estratégias de verificação.
   - **Plano Sequencial de Implementação (Tasks atômicas)** para guiar o `/passo3`.

### Etapa 4: Registro de Sessão e Transição
1. Registre todas as decisões de arquitetura (ADRs) em `docs/sessao_agente.md`.
2. Apresente o resumo da arquitetura e do TRD ao usuário e pergunte:
   > *"A arquitetura (`docs/arquitetura.md`) e o TRD (`docs/trd.md`) estão aprovados para iniciarmos a implementação e configuração do ambiente com o `/passo3`?"*
