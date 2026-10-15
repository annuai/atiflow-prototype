/** Read a file fully, reporting 0-100 as it goes (used by upload dialogs to show real progress). Resolves with the bytes. */
export function readWithProgress(file: File, onProgress: (pct: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    rd.onload = () => {
      onProgress(100);
      resolve(rd.result as ArrayBuffer);
    };
    rd.onerror = () => reject(rd.error);
    rd.readAsArrayBuffer(file);
  });
}
