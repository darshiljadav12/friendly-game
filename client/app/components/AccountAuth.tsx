"use client";

import { useState } from "react";
import { request } from "../../lib/couple";
import type { AccountSession, AccountView } from "../types";

type Done = (session: AccountSession, view: AccountView) => void;
type Result = AccountView & { session?: AccountSession };

// Each person has their own account: sign up once, then log in with username + password
export default function AccountAuth({ connected, onDone }: { connected: boolean; onDone: Done }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const submit = async () => {
    setError(null);
    if (mode === "signup") {
      if (!name.trim()) return setError("Enter your name");
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username.trim())) return setError("Username: 3–20 letters, numbers, dots or underscores");
      if (password.length < 6) return setError("Password must be at least 6 characters");
      if (password !== password2) return setError("The two passwords don't match");
    } else if (!username.trim() || !password) {
      return setError("Enter your username and password");
    }

    setBusy(true);
    const res = await request<Result>(mode === "signup" ? "accountSignup" : "accountLogin", { name, username, password });
    setBusy(false);
    if (res.error || !res.session) return setError(res.error ?? "Something went wrong");
    const { session, ...view } = res;
    onDone(session, view);
  };

  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && submit();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1" role="tablist">
        {(
          [
            ["signup", "Sign up"],
            ["login", "Log in"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className={`rounded-lg py-1.5 text-sm font-semibold transition-colors ${mode === id ? "bg-surface-2 text-white" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      )}

      {mode === "signup" && (
        <label className="block">
          <span className="panel-label">Your name (shown in games)</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="field w-full mt-1.5 p-3" placeholder="Ann" autoComplete="nickname" />
        </label>
      )}

      <label className="block">
        <span className="panel-label">Username</span>
        <input
          value={username}
          maxLength={20}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
          onKeyDown={onEnter}
          className="field w-full mt-1.5 p-3"
          placeholder="ann_23"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <div className={mode === "signup" ? "grid grid-cols-2 gap-2" : ""}>
        <label className="block">
          <span className="panel-label">Password</span>
          <input
            value={password}
            type="password"
            maxLength={100}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter}
            className="field w-full mt-1.5 p-3"
            placeholder="••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        {mode === "signup" && (
          <label className="block">
            <span className="panel-label">Repeat password</span>
            <input
              value={password2}
              type="password"
              maxLength={100}
              onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={onEnter}
              className="field w-full mt-1.5 p-3"
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>
        )}
      </div>

      <button type="submit" disabled={!connected || busy} className="btn btn-primary w-full p-3">
        {busy ? "One moment…" : mode === "signup" ? "Create my account" : "Log in"}
      </button>

      <p className="text-[11px] text-muted">
        {mode === "signup"
          ? "Each of you makes your own account. Then one creates your couple and the other joins it with the couple code."
          : "5 wrong passwords lock the account for 10 minutes."}
      </p>
    </form>
  );
}
