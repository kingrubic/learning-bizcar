"use client";

import Link from "next/link";
import { useState } from "react";

export function VrimStudio({ src, backHref, label }: { src: string; backHref: string; label: string }) {
  const [full, setFull] = useState(false);
  return (
    <div className={`vrim-shell${full ? " is-full" : ""}`}>
      <div className="vrim-bar">
        <Link className="btn" href={backHref}>Quay lại Buổi 04</Link>
        <strong>{label}</strong>
        <span className="vrim-note">Lưu trên trình duyệt, không ghi vào workbook</span>
        <button type="button" className="btn vrim-full" onClick={() => setFull(true)}>Toàn màn hình</button>
      </div>
      {full && (
        <button type="button" className="btn vrim-exit" onClick={() => setFull(false)}>Hiện thanh điều hướng</button>
      )}
      <iframe className="vrim-frame" src={src} title={label} />
    </div>
  );
}
