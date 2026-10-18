export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type FileKind = 'image' | 'video' | 'audio' | 'book' | 'file';

export function fileKind(type: string, name = ''): FileKind {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (
    /pdf|epub|msword|officedocument|text\/|rtf|opendocument/.test(type) ||
    /\.(pdf|epub|docx?|txt|md|rtf|odt|pptx?|xlsx?)$/i.test(name)
  )
    return 'book';
  return 'file';
}
