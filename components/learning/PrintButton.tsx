"use client";

export function PrintButton({ label = "In / PDF" }: { label?: string }) {
  return <button type="button" className="btn dark no-print" onClick={() => window.print()}>{label}</button>;
}
