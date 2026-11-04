const IGNORED_WORDS = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'e',
  'ou',
  'um',
  'uma',
  'the',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  '&',
]);

/**
 * Extrai as duas primeiras letras relevantes do título da música em caixa alta.
 * Ex.: "Fita Cassete" -> "FC", "Polaroid Summer" -> "PS", "The Kites" -> "KI", "Quintal" -> "QU"
 */
export function getTrackInitials(title: string): string {
  const cleaned = title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
    .trim();

  if (!cleaned) return 'VT';

  const words = cleaned.split(/\s+/).filter(Boolean);
  const relevantWords = words.filter((w) => !IGNORED_WORDS.has(w.toLowerCase()));
  const pool = relevantWords.length > 0 ? relevantWords : words;

  if (pool.length >= 2) {
    return (pool[0][0] + pool[1][0]).toUpperCase();
  }

  const single = pool[0];
  if (single.length >= 2) {
    return single.slice(0, 2).toUpperCase();
  }

  return (single[0] + 'X').toUpperCase();
}

/**
 * Monta a legenda curta em caixa alta exibida na base da Polaroid.
 * Retorna "SEM DICA" quando nenhum filtro opcional foi informado.
 */
export function formatPolaroidCaption(preferences?: {
  genres?: string | null;
  language?: string | null;
  era?: string | null;
}): string {
  if (!preferences) return 'SEM DICA';
  const parts = [preferences.genres, preferences.language, preferences.era]
    .map((item) => item?.trim())
    .filter(Boolean) as string[];

  if (parts.length === 0) return 'SEM DICA';
  return parts.join(' · ').toUpperCase();
}
