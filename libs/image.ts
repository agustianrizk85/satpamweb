export type CompressImageOptions = {
  maxKB?: number;
  maxDimension?: number;
  minDimension?: number;
  minQuality?: number;
  watermarkText?: string;
};

export type CompressedImageResult = {
  dataUrl: string;
  sizeBytes: number;
};

export function estimateDataUrlSizeBytes(dataUrl: string): number {
  const match = dataUrl.match(/^data:.*;base64,(.*)$/);
  if (!match) return new TextEncoder().encode(dataUrl).length;

  const base64 = match[1];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatBytesToKB(bytes: number): string {
  return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = dataUrl;
  });
}

function drawContain(canvas: HTMLCanvasElement, img: HTMLImageElement, width: number, height: number) {
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function drawWatermark(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");
  const trimmed = text.trim();
  if (!trimmed) return;

  const fontSize = Math.max(12, Math.round(canvas.width * 0.03));
  const pad = Math.max(8, Math.round(fontSize * 0.5));
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const textWidth = Math.ceil(ctx.measureText(trimmed).width);
  const boxHeight = fontSize + pad;
  const boxWidth = textWidth + pad * 2;
  const x = Math.max(0, canvas.width - boxWidth - pad);
  const y = Math.max(0, canvas.height - boxHeight - pad);

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textBaseline = "middle";
  ctx.fillText(trimmed, x + pad, y + boxHeight / 2);
  ctx.restore();
}

export async function compressImageDataUrl(
  dataUrl: string,
  options: CompressImageOptions = {},
): Promise<CompressedImageResult> {
  const maxKB = options.maxKB ?? 200;
  const maxBytes = maxKB * 1024;
  const maxDimension = options.maxDimension ?? 1600;
  const minDimension = options.minDimension ?? 320;
  const minQuality = options.minQuality ?? 0.35;
  const watermarkText = options.watermarkText?.trim() ?? "";

  const img = await loadImage(dataUrl);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.44, 0.38, minQuality].filter(
    (q, idx, arr) => q >= minQuality && arr.indexOf(q) === idx,
  );

  const canvas = document.createElement("canvas");
  let bestDataUrl = dataUrl;
  let bestSize = estimateDataUrlSizeBytes(dataUrl);

  for (let pass = 0; pass < 8; pass++) {
    drawContain(canvas, img, width, height);
    if (watermarkText) drawWatermark(canvas, watermarkText);

    for (const quality of qualitySteps) {
      const out = canvas.toDataURL("image/jpeg", quality);
      const size = estimateDataUrlSizeBytes(out);

      if (size < bestSize) {
        bestDataUrl = out;
        bestSize = size;
      }

      if (size <= maxBytes) return { dataUrl: out, sizeBytes: size };
    }

    const nextWidth = Math.round(width * 0.85);
    const nextHeight = Math.round(height * 0.85);
    if (nextWidth < minDimension || nextHeight < minDimension) break;
    width = nextWidth;
    height = nextHeight;
  }

  return { dataUrl: bestDataUrl, sizeBytes: bestSize };
}

export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressedImageResult> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file foto."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file foto."));
    reader.readAsDataURL(file);
  });

  return compressImageDataUrl(source, options);
}
