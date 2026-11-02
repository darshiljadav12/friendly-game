"use client";

import { useState } from "react";
import { request } from "../../lib/couple";
import type { AccountSession, AccountView } from "../types";

// Shown after login when the account isn't in a couple yet
export default function CoupleLink({
  session,
  name,
  connected,
  onLinked,
  onLogout,
}: {
  session: AccountSession;
  name: string;
  connected: boolean;
  onLinked: (view: AccountView) => void;
  onLogout: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await request<AccountView>("coupleCreate", session);
    setBusy(false);
    if (res.error) return setError(res.error);
    onLinked(res);
  };

  const join = async () => {
    if (!code.trim()) return setError("Enter your partner's couple code");
    setBusy(true);
    setError(null);
    const res = await request<AccountView>("coupleJoin", { session, code });
    setBusy(false);
    if (res.error) return setError(res.error);
    onLinked(res);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-sunken p-3">
        <p className="text-sm">
          Hi <b className="text-rose">{name}</b> 👋
        </p>
        <button onClick={onLogout} className="text-[11px] text-muted underline hover:text-white">
          Log out
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-line bg-sunken/60 p-4 space-y-2">
        <p className="text-sm font-bold">💑 Start your couple</p>
        <p className="text-xs text-muted">You&apos;ll get a code like LOVE-7K2Q to send to your partner.</p>
        <button onClick={create} disabled={!connected || busy} className="btn btn-primary w-full p-3">
          Create our couple
        </button>
      </div>

      <div className="flex items-center gap-3 text-muted/60 text-xs">
        <div className="h-px flex-1 bg-line" />
        or
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="rounded-2xl border border-line bg-sunken/60 p-4 space-y-2">
        <p className="text-sm font-bold">💌 Join your partner</p>
        <p className="text-xs text-muted">Enter the couple code your partner sent you.</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            className="field min-w-0 flex-1 p-3 font-mono tracking-[0.2em]"
            placeholder="LOVE-XXXX"
            aria-label="Couple code"
          />
          <button onClick={join} disabled={!connected || busy} className="btn btn-secondary px-5">
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
