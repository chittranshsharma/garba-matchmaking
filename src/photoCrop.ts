export const CROP_WIDTH = 420
export const CROP_HEIGHT = 400

export function cropGeometry(imageWidth: number, imageHeight: number, rotation: number, zoom: number) {
  const sideways = Math.abs(rotation % 180) === 90
  const rotatedWidth = sideways ? imageHeight : imageWidth
  const rotatedHeight = sideways ? imageWidth : imageHeight
  const scale = Math.max(CROP_WIDTH / rotatedWidth, CROP_HEIGHT / rotatedHeight) * zoom
  return {
    scale,
    maxX: Math.max(0, (rotatedWidth * scale - CROP_WIDTH) / 2),
    maxY: Math.max(0, (rotatedHeight * scale - CROP_HEIGHT) / 2),
  }
}

export function clampCropOffset(offset: { x: number, y: number }, maxX: number, maxY: number) {
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  }
}
