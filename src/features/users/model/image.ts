/** Profile pictures: what is accepted, and shrinking a chosen photo to a small square so it fits in the saved user list. */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 256;

export const validAvatarFile = (f: { type: string; size: number }) => AVATAR_TYPES.includes(f.type) && f.size <= AVATAR_MAX_BYTES;

/** The photo cropped to a centred square and scaled to 256 px, as a JPEG data URL (about 15-40 KB). */
export async function avatarFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file); const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = AVATAR_SIZE; const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);                      // transparent pictures get a white background
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE); bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
