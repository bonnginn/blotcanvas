// Safari may resolve a Blob download after the click handler has returned.
// Keep its URL alive while the browser opens the download/save prompt.
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  // If download is ignored, never navigate away from the working project.
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.hidden = true;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
