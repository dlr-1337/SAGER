/** Download only a blob obtained through the authorized application API. */
export function downloadExitDocument(
  blob: Blob,
  documentVersionId: string,
  kind: 'original' | 'assinado',
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const identifier = /^[0-9a-f-]{36}$/i.test(documentVersionId) ? documentVersionId : 'documento';
  anchor.download = `sager-saida-longa-${identifier}-${kind}.pdf`;
  anchor.rel = 'noopener';
  anchor.referrerPolicy = 'no-referrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
