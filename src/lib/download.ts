/** Hands the keeper a file. Nothing leaves the device. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stampedName = (prefix: string, at = Date.now()): string => `${prefix}-${new Date(at).toISOString().slice(0, 10)}.json`;
