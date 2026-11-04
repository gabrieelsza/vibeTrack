import { MusicPreferences, PhotoAnalysis } from '../types';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MAX_ANALYSIS_DIMENSION = Number(import.meta.env.VITE_IMAGE_MAX_DIMENSION || 800);
const ANALYSIS_JPEG_QUALITY = Number(import.meta.env.VITE_IMAGE_QUALITY || 0.8);

export interface CompressedPhotoResult {
  imageBase64: string;
  imageThumbnail: string;
  imageHash: string;
  width: number;
  height: number;
}

const clientAnalysisCache = new Map<string, PhotoAnalysis>();

/**
 * Calcula um hash determinístico (SHA-256 ou FNV-1a de fallback) para imagem + filtros escolhidos.
 */
export async function computePhotoAndFilterHash(
  imageBase64: string,
  preferences?: MusicPreferences
): Promise<string> {
  const normalizedPrefs = [
    preferences?.genres?.trim().toLowerCase() || '',
    preferences?.language?.trim().toLowerCase() || '',
    preferences?.era?.trim().toLowerCase() || '',
  ].join('|');

  const payload = `${imageBase64}::${normalizedPrefs}`;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(payload));
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback síncrono abaixo
    }
  }

  return computeFastHashSync(payload);
}

export function computeFastHashSync(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getCachedAnalysisByHash(hashKey: string): PhotoAnalysis | null {
  return clientAnalysisCache.get(hashKey) || null;
}

export function setCachedAnalysisByHash(hashKey: string, analysis: PhotoAnalysis): void {
  clientAnalysisCache.set(hashKey, analysis);
}

/**
 * Valida, redimensiona e comprime a imagem no cliente usando HTML5 Canvas (RT-002 / RNF-003)
 * para reduzir custo e latência no envio para a IA.
 */
export async function validateAndCompressPhoto(file: File): Promise<CompressedPhotoResult> {
  if (!file || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    throw new Error(
      'Formato inválido. Selecione uma fotografia nos formatos JPEG, PNG ou WebP.'
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      'A foto selecionada excede 10 MB. Escolha uma imagem menor.'
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error('Não foi possível ler o arquivo de imagem selecionado.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          'O arquivo selecionado parece corrompido ou não é uma imagem válida.'
        )
      );
    image.src = dataUrl;
  });

  const renderResized = (maxDimension: number, quality: number): string => {
    let targetW = img.naturalWidth || img.width || 800;
    let targetH = img.naturalHeight || img.height || 800;

    if (targetW > maxDimension || targetH > maxDimension) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * maxDimension) / targetW);
        targetW = maxDimension;
      } else {
        targetW = Math.round((targetW * maxDimension) / targetH);
        targetH = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
  };

  const imageBase64 = renderResized(MAX_ANALYSIS_DIMENSION, ANALYSIS_JPEG_QUALITY);
  const imageThumbnail = renderResized(480, 0.78);
  const imageHash = await computePhotoAndFilterHash(imageBase64);

  return {
    imageBase64,
    imageThumbnail,
    imageHash,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  };
}

/**
 * Gera uma fotografia sintética de demonstração em DataURL (para facilitar testes rápidos no navegador).
 */
export function generateSampleDemoPhoto(preset: 'sunset' | 'neon' | 'cozy'): CompressedPhotoResult {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  if (preset === 'sunset') {
    const grad = ctx.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.45, '#be185d');
    grad.addColorStop(0.75, '#f59e0b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 640);

    // Sol no horizonte
    ctx.beginPath();
    ctx.arc(320, 390, 95, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // Silhueta de mar/montanha
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 440, 640, 200);
  } else if (preset === 'neon') {
    const grad = ctx.createLinearGradient(0, 0, 640, 640);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#311042');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 640);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 10;
    ctx.strokeRect(90, 110, 460, 420);

    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(320, 320, 120, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const grad = ctx.createLinearGradient(0, 0, 640, 640);
    grad.addColorStop(0, '#134e4a');
    grad.addColorStop(0.6, '#065f46');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 640);

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(320, 300, 85, 0, Math.PI * 2);
    ctx.fill();
  }

  const dataUrl = canvas.toDataURL('image/jpeg', ANALYSIS_JPEG_QUALITY);
  return {
    imageBase64: dataUrl,
    imageThumbnail: dataUrl,
    imageHash: computeFastHashSync(dataUrl),
    width: 640,
    height: 640,
  };
}
