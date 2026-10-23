const MAX_SIDE = 1920

export interface CompressedImage {
  base64: string
  mimeType: string
  fileName: string
}

/**
 * Downscales to at most 1920px on the long side and re-encodes as WebP
 * (JPEG where WebP encoding is unsupported). Keeps uploads small enough for GAS.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let blob = await toBlob(canvas, 'image/webp', 0.85)
  if (blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const base = file.name.replace(/\.[^.]+$/, '') || 'screenshot'
  return { base64: await toBase64(blob), mimeType: blob.type, fileName: `${base}.${ext}` }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片轉檔失敗'))), type, quality),
  )
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Drive-hosted image URL; works because uploads are shared "anyone with the link". */
export function driveImageUrl(fileId: string, width = 1600): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`
}
