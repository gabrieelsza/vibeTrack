# Contexto do Projeto (Vibe Coding Sensato & SDD)

## 1. Visão Geral e Objetivo
> _Propósito central do sistema, problema real que ele resolve e valor entregue aos usuários._

- **Nome do Projeto:** VibeTrack
- **Objetivo Principal:** Oferecer um aplicativo instalável que analisa fotografias enviadas pelo usuário por meio de inteligência artificial — identificando clima, emoções, estética e contexto visual — e recomenda de 3 a 5 músicas que harmonizem com o momento retratado, explicando o motivo de cada escolha e disponibilizando um trecho sonoro para audição imediata.
- **Proposta de Valor:** Transformar momentos visuais em experiências sonoras personalizadas, eliminando a dificuldade de encontrar a trilha sonora ideal para acompanhar memórias, postagens ou momentos especiais do dia a dia.

---

## 2. Público-Alvo e Personas
| Persona / Papel | Descrição | Principais Necessidades / Dores |
| :--- | :--- | :--- |
| **Criador de Conteúdo / Usuário Social** | Pessoa que compartilha fotos com frequência em redes sociais e aplicativos de mensagens. | Perde muito tempo procurando uma música que combine com a estética e a emoção da foto antes de publicar; deseja sugestões justificadas e um cartão visual pronto para compartilhar. |
| **Entusiasta de Música e Memórias** | Usuário que gosta de descobrir novas músicas a partir de momentos do cotidiano, viagens ou paisagens. | Quer descobrir faixas alinhadas ao seu gosto (gênero, idioma, época) que traduzam o sentimento de uma imagem, podendo ouvir uma prévia na hora e consultar seu histórico depois. |

---

## 3. Escopo do Projeto (MVP vs. Futuro)

### 3.1. Dentro do Escopo (In-Scope - MVP)
- [x] **Criação de Conta e Identificação Obrigatória:** Acesso mediante cadastro e identificação do usuário para vincular histórico.
- [x] **Envio de Fotografia e Preferências Opcionais:** Seleção de imagem do aparelho (com possibilidade de informar preferências opcionais de gênero musical, idioma ou época antes da análise).
- [x] **Análise Inteligente de Clima, Emoção e Contexto:** Leitura automatizada da imagem extraindo a atmosfera emocional, cenário e elementos visuais predominantes.
- [x] **Recomendação de 3 a 5 Músicas Justificadas:** Lista contendo título, artista, capa do álbum, explicação personalizada do motivo da combinação com a foto, reprodutor de trecho de áudio (uma faixa por vez) e atalho para ouvir a obra completa em serviços externos de música.
- [x] **Atenuação Inteligente de Sinal Sonoro:** Priorização de músicas com trecho de áudio disponível; caso uma sugestão ideal não possua prévia liberada, exibição normal da recomendação com justificativa, aviso visual discreto e link direto para audição externa.
- [x] **Geração de Novas Sugestões:** Opção para solicitar uma nova rodada de recomendações para a mesma foto de forma ilimitada.
- [x] **Uso Ilimitado com Proteção Técnica e Cache Inteligente:** Uso livre de análises para o usuário, acompanhado de compressão de imagem, cache por hash da foto + filtros escolhidos e proteção anti-spam por minuto no servidor (`RATE_LIMIT_PER_MINUTE`).
- [x] **Histórico Completo com Gestão pelo Usuário:** Armazenamento na conta do usuário contendo a miniatura da foto, a leitura de clima/emoção e as músicas recomendadas, permitindo consulta posterior (inclusive quando sem conexão para itens já carregados) e exclusão de registros pelo próprio usuário.
- [x] **Compartilhamento de Resumo Visual ("Card"):** Geração de um cartão visual combinando a foto do usuário e a música selecionada para compartilhamento em redes sociais ou mensageiros.
- [x] **Instalação no Aparelho e Comportamento Sem Internet:** Capacidade de instalar o aplicativo na tela inicial do dispositivo e visualizar o histórico já sincronizado mesmo sem conexão ativa, informando claramente que novas análises exigem sinal de internet.

### 3.2. Fora do Escopo (Out-of-Scope - Pós-MVP)
- [ ] Uso anônimo ou sem identificação de conta.
- [ ] Reprodução integral de músicas completas dentro do próprio aplicativo (apenas trechos de demonstração são reproduzidos internamente).
- [ ] Edição avançada de imagem ou aplicação de filtros visuais na fotografia enviada.
- [ ] Envio e análise de vídeos ou múltiplos arquivos simultâneos em lote.
- [ ] Rede social interna (feed público, comentários ou seguidores dentro do próprio aplicativo).

---

## 4. Premissas, Restrições e Dependências
- **Premissas de Negócio:**
  - Todo usuário deve estar identificado em sua conta para realizar análises e acessar seu histórico.
  - O uso é ilimitado para o usuário, contando com cache inteligente por hash e proteção técnica por minuto contra abusos automatizados.
- **Restrições Operacionais e de Uso:**
  - Apenas uma prévia musical pode tocar por vez; iniciar a reprodução de outra sugestão pausa automaticamente a anterior.
  - Novas análises de imagem e geração de novas sugestões dependem obrigatoriamente de conexão ativa com a internet.
- **Dependências Externas (Visão de Negócio):**
  - Serviço de inteligência artificial capaz de interpretar imagens e gerar recomendações musicais contextualizadas.
  - Catálogo musical externo capaz de fornecer metadados das faixas (capa, título, artista), links para audição completa e trechos sonoros de demonstração.

---

## 5. Glossário de Domínio (Ubiquitous Language)
| Termo | Definição no Contexto do Negócio |
| :--- | :--- |
| **Vibe (Clima e Contexto)** | Conjunto de características emocionais, estéticas, de iluminação, ambiente e sentimento identificados na fotografia enviada pelo usuário. |
| **Análise de Foto** | Processo completo em que o usuário envia uma imagem (com ou sem preferências musicais) e recebe a leitura da "Vibe" acompanhada de 3 a 5 recomendações musicais. |
| **Proteção Anti-Abuso (Rate Limit)** | Controle técnico transparente no servidor (ex.: máximo de 10 requisições por minuto por usuário/IP) que evita spam sem impor travas visuais ao uso normal. |
| **Trecho Sonoro (Prévia)** | Amostra curta de áudio (aproximadamente 30 segundos) da música recomendada para que o usuário avalie a sonoridade diretamente na tela de resultados. |
| **Atenuação de Prévia Indisponível** | Regra de contingência pela qual uma música altamente compatível, mas sem trecho de áudio liberado pelo catálogo externo, ainda é exibida ao usuário com sua justificativa e atalho para audição externa. |
| **Card Compartilhável** | Imagem resumo gerada pelo aplicativo contendo a fotografia analisada, o clima detectado e o destaque da música escolhida, pronta para envio externo. |
