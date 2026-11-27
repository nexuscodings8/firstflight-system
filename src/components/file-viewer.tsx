"use client";
import Link from "next/link";
import { useState } from "react";

/** Preview of a private file: PDFs in a frame, images with zoom; other types download. */
export function FileViewer({ src, download, mime, fileName }: { src: string; download: string; mime: string; fileName: string }) {
  const [zoom, setZoom] = useState(1);
  const isPdf = mime === "application/pdf", isImg = mime.startsWith("image/");
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <p className="truncate text-sm font-semibold">{fileName}</p>
        <div className="flex flex-wrap gap-2">
          {isImg && <>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">−</button>
            <span className="self-center text-sm tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">+</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setZoom(1)}>Fit</button>
          </>}
          <a className="btn-ghost btn-sm" href={src} target="_blank" rel="noopener">Open in new tab</a>
          <a className="btn-primary btn-sm" href={download}>Download</a>
        </div>
      </div>
      {isPdf ? <iframe title={fileName} src={src} className="h-[75vh] w-full bg-mist" data-testid="pdf-frame" />
        // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked file; next/image would proxy it
        : isImg ? <div className="max-h-[75vh] overflow-auto bg-mist p-3"><img src={src} alt={fileName} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block" data-testid="image-preview" /></div>
        : <div className="p-6"><p>This file type can&apos;t be previewed in the browser.</p><Link className="btn-primary btn-sm mt-3" href={download}>Download {fileName}</Link></div>}
    </div>
  );
}
