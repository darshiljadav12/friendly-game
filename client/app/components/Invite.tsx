"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Link + QR code that opens the game with the room code filled in
export default function Invite({ roomId, isCouple, partnerName }: { roomId: string; isCouple: boolean; partnerName?: string }) {
  // Only rendered once a room exists (never during server rendering), so window is available
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/join/${roomId}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#1b1020", light: "#fdf2f8" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  const copy = async (what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : roomId);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard needs https or localhost; the text is visible anyway
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Friendly Game", text: `Come play with me 💞 Room ${roomId}`, url: link });
    } catch {
      // user cancelled
    }
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="space-y-3">
      <button onClick={() => copy("code")} className="btn btn-secondary w-full py-4 font-mono text-4xl tracking-[0.35em] text-gold" title="Copy code">
        {roomId}
      </button>

      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
        <img src={qr} alt={`QR code to join room ${roomId}`} width={160} height={160} className="mx-auto rounded-xl" />
      )}

      <div className="flex gap-2">
        <input readOnly value={link} className="field min-w-0 flex-1 px-3 py-2 text-xs" aria-label="Invite link" onFocus={(e) => e.target.select()} />
        <button onClick={() => copy("link")} className="btn btn-secondary px-3 text-xs">
          {copied === "link" ? "✅" : "Copy"}
        </button>
        {canShare && (
          <button onClick={share} className="btn btn-primary px-3 text-xs">
            Share
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">
        {copied === "code"
          ? "✅ Code copied"
          : isCouple
            ? `${partnerName ?? "Your partner"} opens the link (or scans the QR) while logged in to your couple.`
            : "Send the link or let them scan the QR code. It opens the game with the code filled in."}
      </p>
    </div>
  );
}
