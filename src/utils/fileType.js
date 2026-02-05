/**
 * Detect media category from file MIME type, File object, or category string.
 * @param {string|File} mimeOrFile - MIME type (e.g. 'image/jpeg'), File object, or 'image'|'audio'|'video'
 * @returns {'image'|'audio'|'video'}
 */
export function getMediaCategory(mimeOrFile) {
  if (!mimeOrFile) return 'video'
  const str = typeof mimeOrFile === 'string' ? mimeOrFile : mimeOrFile?.type || ''
  if (str === 'image' || /^image\//i.test(str)) return 'image'
  if (str === 'audio' || /^audio\//i.test(str)) return 'audio'
  if (str === 'video') return 'video'
  return 'video'
}
