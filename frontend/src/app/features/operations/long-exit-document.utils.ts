const extensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** The authorization returned by a guardian may be a photo, so the name follows the real type. */
export const isAuthorizationMediaType = (type: string): boolean => Object.hasOwn(extensions, type);

/** Download only a blob obtained through the authorized application API. */
export function downloadExitDocument(blob: Blob, id: string, kind: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const identifier = /^[0-9a-f-]{36}$/i.test(id) ? id : 'documento';
  anchor.download = `sager-saida-longa-${identifier}-${kind}.${extensions[blob.type] ?? 'pdf'}`;
  anchor.rel = 'noopener';
  anchor.referrerPolicy = 'no-referrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
