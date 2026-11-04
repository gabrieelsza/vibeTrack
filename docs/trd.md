# Technical Requirement Document (TRD) — VibeTrack

> **Status do Documento:** `APROVADO E IMPLEMENTADO (FASE 3)`  
> **Responsável:** Skill de Profissional Técnico de Arquitetura (`/passo2`)  
> **Baseado no BRD:** [`docs/brd.md`](./brd.md)  
> **Arquitetura de Referência:** [`docs/arquitetura.md`](./arquitetura.md)  
> **Última Atualização:** 2026-11-03

---

## 1. Matriz de Rastreabilidade Técnica (BRD -> TRD)

| ID Técnico | Ref. BRD (`RF-XXX`) | Camada / Componente | Especificação Técnica de Implementação | Complexidade | Status |
| :--- | :---: | :--- | :--- | :---: | :---: |
| **RT-001** | `RF-001` | **Backend (`AuthController`, `AuthService`) & Frontend (`AuthContext`, `AuthPage`)** | Autenticação obrigatória com registro e login por e-mail/senha. Senhas criptografadas com `bcryptjs` (10 rounds) no PostgreSQL (Neon) via Prisma. Emissão de token `JWT` (validade 7d). Rotas privadas protegidas no Express (`auth.middleware.ts`). | Baixa | `Implementado` |
| **RT-002** | `RF-002` | **Frontend (`image-compressor.service`) & Backend (`AnalysisController`)** | Validação client-side e server-side (Zod) para aceitar apenas imagens válidas (`image/jpeg`, `image/png`, `image/webp`, até 10MB brutos). Compressão client-side via Canvas gerando payload Base64 otimizado (`VITE_IMAGE_MAX_DIMENSION=800`, `VITE_IMAGE_QUALITY=0.8`). Campos opcionais de preferência (`genres`, `language`, `era`). | Média | `Implementado` |
| **RT-003** | `RF-003` | **Backend (`rate-limit.middleware.ts`, `resilience.util.ts`, `AnalysisService`) & Frontend (`HomeAnalysisPage`, `MusicalLoadingStage`)** | **Uso Ilimitado com Resiliência a 429, Fila de Concorrência, Retry com Backoff e Cache:** Sem trava diária de análises. Proteção técnica no servidor via `analysisRateLimitMiddleware` (`RATE_LIMIT_PER_MINUTE=30`, desativável com `0`), fila de concorrência por serviço (`MAX_CONCURRENT_AI=2`, `MAX_CONCURRENT_MUSIC=2`), `withRetryWithBackoff` respeitando `Retry-After` e backoff exponencial com jitter (`MAX_RETRIES=3`, teto ~15s) apenas em `429`/`5xx`, cache por hash da imagem+filtros e por consulta musical (`CACHE_TTL_SECONDS=14400`), busca musical em lote com fallback gracioso (`"Preview indisponível agora"`), resposta `503 { code: "BUSY", retryAfterSeconds }` quando esgotar tentativas e tela de carregamento musical retrô (`MusicalLoadingStage`) com mínimo de ~3s, etapas a cada 2s, `AbortController` e botão `"TENTAR DE NOVO"` com cooldown. | Alta | `Implementado` |
| **RT-004** | `RF-004` | **Backend (`AiVisionService` - Google Gemini API)** | Integração com `@google/genai` usando modelo configurável via `GEMINI_MODEL` (padrão `gemini-3.1-flash-lite`, validado no startup via `validateModelOnStartup`) recebendo a imagem inline (`inlineData` Base64) + preferências opcionais do usuário. Uso de `responseSchema` JSON estrito (`vibeSummary`, `moodTags`, `dominantColors`, `tracks`). Retorna `isFallback: false` quando a IA responde com sucesso, e `isFallback: true` + `fallbackReason` (`NO_API_KEY`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `INVALID_AI_RESPONSE`) + `upstreamStatus` exclusivamente quando há erro real da API, sem cachear fallbacks e exibindo aviso explícito + selo `"SUGESTÃO POPULAR"` no front-end. | Alta | `Implementado` |
| **RT-005** | `RF-005` | **Backend (`AiVisionService` + `MusicCatalogService`) & Frontend (`TopTrackCard`, `TrackListItem`)** | O schema estruturado da IA retorna de **3 a 5 recomendações musicais**, cada uma com `title`, `artist` e `reason`. O `MusicCatalogService` consulta paralelamente a **iTunes Search API** (com fallback para **Deezer Public API**) para enriquecer cada faixa com `albumArtUrl`, `previewUrl` (trecho de 30s) e `externalUrl`. | Alta | `Implementado` |
| **RT-006** | `RF-006` | **Backend (`MusicCatalogService`) & Frontend (`AudioPlayerContext`)** | **Priorização e Atenuação Sonora:** Na busca de catálogo musical, o backend prioriza resultados que possuam `previewUrl` válida (`hasPreview = true`). Caso uma música ideal não tenha prévia disponível (`previewUrl = null`), ela é mantida na resposta com `hasPreview: false` e `externalUrl` preenchida. No frontend, o `AudioPlayerContext` mantém uma instância única (`singleton`) de `HTMLAudioElement`. | Média | `Implementado` |
| **RT-007** | `RF-007` | **Backend (`POST /api/v1/analyses/:id/regenerate`) & Frontend (`HomeAnalysisPage`)** | Permite gerar uma nova rodada de 3 a 5 músicas inéditas para uma análise já existente sem reenviar o arquivo de imagem, passando as músicas anteriores na lista de exclusão da IA. | Média | `Implementado` |
| **RT-008** | `RF-008` | **Backend (`AnalysisController`, `AnalysisRepository`) & Frontend (`HistoryPage`)** | Persistência completa no Neon PostgreSQL (`photo_analyses` e `music_recommendations` com `ON DELETE CASCADE`). Listagem ordenada por `createdAt DESC` (`GET /api/v1/analyses`) e exclusão permanente pelo dono da conta (`DELETE /api/v1/analyses/:id`). | Baixa | `Implementado` |
| **RT-009** | `RF-009` | **Frontend (`ShareCardModal`)** | Renderização client-side usando **HTML5 Canvas API nativa (`CanvasRenderingContext2D`)** na resolução `1080x1350px`. Exporta arquivo PNG (`canvas.toBlob`) compatível com `navigator.share` e download direto. | Média | `Implementado` |
| **RT-010** | `RF-010` | **Frontend (`manifest.webmanifest`, Service Worker, `NetworkContext`, `offline-cache.service`)** | Configuração de **PWA instalável** e espelhamento do histórico em `localStorage` (`vibetrack_offline_history_${userId}`) para consulta sem internet. | Média | `Implementado` |

---

## 2. Modelagem de Dados e Esquema Físico (Prisma + Neon PostgreSQL)

### 2.1. Especificação das Tabelas Relacionais

| Tabela PostgreSQL | Campos e Tipos Físicos | Chaves e Índices | Constraints e Regras de Integridade |
| :--- | :--- | :--- | :--- |
| **`users`** | `id` (UUID)<br>`name` (VARCHAR 120)<br>`email` (VARCHAR 255)<br>`password_hash` (VARCHAR 255)<br>`created_at` (TIMESTAMPTZ)<br>`updated_at` (TIMESTAMPTZ) | **PK:** `id`<br>**UNIQUE:** `email` | Isolamento completo de histórico por conta de usuário. |
| **`photo_analyses`** | `id` (UUID)<br>`user_id` (UUID)<br>`image_thumbnail` (TEXT - DataURL WebP/JPEG comprimida)<br>`pref_genres` (VARCHAR 255 NULL)<br>`pref_language` (VARCHAR 100 NULL)<br>`pref_era` (VARCHAR 100 NULL)<br>`vibe_summary` (TEXT)<br>`mood_tags` (TEXT[] / JSONB)<br>`dominant_colors` (TEXT[] / JSONB)<br>`created_at` (TIMESTAMPTZ) | **PK:** `id`<br>**FK:** `user_id -> users.id`<br>**IDX:** `(user_id, created_at DESC)` | `ON DELETE CASCADE` a partir de `users`. Garante carregamento rápido do histórico do usuário. |
| **`music_recommendations`** | `id` (UUID)<br>`analysis_id` (UUID)<br>`rank_order` (INT 1..5)<br>`title` (VARCHAR 255)<br>`artist` (VARCHAR 255)<br>`album_art_url` (TEXT NULL)<br>`reason` (TEXT)<br>`preview_url` (TEXT NULL)<br>`has_preview` (BOOLEAN DEFAULT false)<br>`external_url` (TEXT)<br>`external_provider` (VARCHAR 50 DEFAULT 'Streaming') | **PK:** `id`<br>**FK:** `analysis_id -> photo_analyses.id`<br>**IDX:** `(analysis_id, rank_order ASC)` | `ON DELETE CASCADE` a partir de `photo_analyses`. |

### 2.2. Schema Prisma de Referência (`backend/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String          @id @default(uuid())
  name         String
  email        String          @unique
  passwordHash String          @map("password_hash")
  createdAt    DateTime        @default(now()) @map("created_at")
  updatedAt    DateTime        @updatedAt @map("updated_at")
  analyses     PhotoAnalysis[]

  @@map("users")
}

model PhotoAnalysis {
  id              String                @id @default(uuid())
  userId          String                @map("user_id")
  imageThumbnail  String                @db.Text @map("image_thumbnail")
  prefGenres      String?               @map("pref_genres")
  prefLanguage    String?               @map("pref_language")
  prefEra         String?               @map("pref_era")
  vibeSummary     String                @db.Text @map("vibe_summary")
  moodTags        String[]              @map("mood_tags")
  dominantColors  String[]              @map("dominant_colors")
  createdAt       DateTime              @default(now()) @map("created_at")
  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  recommendations MusicRecommendation[]

  @@index([userId, createdAt(sort: Desc)])
  @@map("photo_analyses")
}

model MusicRecommendation {
  id               String        @id @default(uuid())
  analysisId       String        @map("analysis_id")
  rankOrder        Int           @map("rank_order")
  title            String
  artist           String
  albumArtUrl      String?       @map("album_art_url")
  reason           String        @db.Text
  previewUrl       String?       @map("preview_url")
  hasPreview       Boolean       @default(false) @map("has_preview")
  externalUrl      String        @map("external_url")
  externalProvider String        @default("Streaming") @map("external_provider")
  analysis         PhotoAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  @@index([analysisId, rankOrder(sort: Asc)])
  @@map("music_recommendations")
}
```

---

## 3. Contratos de API e Interfaces (Endpoints REST)

Base URL local: `http://localhost:3001/api/v1`

| Método | Rota | Payload de Entrada (Request Body / Params) | Resposta Esperada (Status & JSON) | Auth | Ref. BRD |
| :---: | :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/health` | Nenhum | `200 OK`: `{ status: "ok", db: "connected", timestamp: "..." }` | Público | Infra |
| `POST` | `/api/v1/auth/register` | `{ name: string, email: string, password: string (min 6) }` | `201 Created`: `{ token: string, user: { id, name, email } }`<br>`400/409`: E-mail já cadastrado ou dados inválidos. | Público | `RF-001` |
| `POST` | `/api/v1/auth/login` | `{ email: string, password: string }` | `200 OK`: `{ token: string, user: { id, name, email } }`<br>`401 Unauthorized`: Credenciais inválidas. | Público | `RF-001` |
| `GET` | `/api/v1/auth/me` | Header `Authorization: Bearer <token>` | `200 OK`: `{ user: { id, name, email } }` | JWT | `RF-001` |
| `POST` | `/api/v1/analyses` | `{ imageBase64: string, imageThumbnail?: string, preferences?: { genres?: string, language?: string, era?: string } }` | `201 Created`: `{ analysis: { id, createdAt, imageThumbnail, preferences, vibeSummary, moodTags, dominantColors, recommendations: [...] }, cached: boolean }`<br>`400/422`: Imagem inválida/corrompida.<br>`429 Too Many Requests`: Rate limit por minuto atingido (`"Calma, tente de novo em alguns segundos"`).<br>`502 Bad Gateway`: Falha na IA externa. | JWT | `RF-002`, `RF-003`, `RF-004`, `RF-005`, `RF-006` |
| `POST` | `/api/v1/analyses/:id/regenerate` | Param `:id` da análise original | `201 Created`: Retorna um novo objeto `analysis` com 3 a 5 músicas inéditas para a mesma foto.<br>`429 Too Many Requests`: Rate limit por minuto atingido. | JWT | `RF-003`, `RF-007` |
| `GET` | `/api/v1/analyses` | Header `Authorization: Bearer <token>` | `200 OK`: `{ analyses: [ ...lista de análises do usuário com suas recommendations ordenadas por createdAt DESC ] }` | JWT | `RF-008`, `RF-010` |
| `DELETE` | `/api/v1/analyses/:id` | Param `:id` da análise | `200 OK`: `{ message: "Análise removida com sucesso", deletedId: string }`<br>`404 Not Found`: Análise inexistente ou pertencente a outro usuário. | JWT | `RF-008` |
