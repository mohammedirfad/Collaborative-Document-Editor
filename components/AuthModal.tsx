"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, UserPlus, X } from "lucide-react";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
  onToken: (token: string) => void;
  onToast: (message: string) => void;
};

type AuthMode = "login" | "register";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthModal({ open, reason, onClose, onToken, onToast }: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  if (!open) return null;

  async function submit() {
    const nextErrors = validateForm(mode, { name, email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setErrors({});
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        onToast(formatBackendError(mode, payload));
        return;
      }
      onToken(payload.token);
      onClose();
    } catch {
      onToast("Unable to reach the auth server. Check DATABASE_URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cedar text-white">
              <LockKeyhole size={20} aria-hidden />
            </div>
            <div>
              <h2 id="auth-title" className="text-lg font-bold text-ink">
                Sign in required
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{reason ?? "Please sign in before editing this shared document."}</p>
            </div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close sign in modal">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 grid grid-cols-2 rounded-md bg-slate-100 p-1">
            <button className={`h-10 rounded-md text-sm font-semibold ${mode === "login" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`} onClick={() => switchMode("login")}>
              Sign in
            </button>
            <button className={`h-10 rounded-md text-sm font-semibold ${mode === "register" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`} onClick={() => switchMode("register")}>
              Create account
            </button>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <label className="block text-sm font-medium text-slate-700">
                Name
                <input
                  className={`mt-1 h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-cedar ${errors.name ? "border-red-400" : "border-slate-300"}`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <span className="mt-1 block text-xs font-medium text-red-600">{errors.name}</span>}
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                className={`mt-1 h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-cedar ${errors.email ? "border-red-400" : "border-slate-300"}`}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span className="mt-1 block text-xs font-medium text-red-600">{errors.email}</span>}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <span className={`mt-1 flex h-11 overflow-hidden rounded-md border focus-within:border-cedar ${errors.password ? "border-red-400" : "border-slate-300"}`}>
                <input
                  className="min-w-0 flex-1 px-3 text-sm outline-none"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                />
                <button className="grid w-11 place-items-center text-slate-500 hover:bg-slate-100" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </span>
              {errors.password && <span className="mt-1 block text-xs font-medium text-red-600">{errors.password}</span>}
            </label>
          </div>

          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" onClick={submit} disabled={loading}>
            {mode === "login" ? <LogIn size={17} aria-hidden /> : <UserPlus size={17} aria-hidden />}
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>
      </section>
    </div>
  );
}

function validateForm(mode: AuthMode, values: { name: string; email: string; password: string }) {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  const password = values.password;

  if (mode === "register" && values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 10) {
    errors.password = "Password must be at least 10 characters.";
  }

  return errors;
}

function formatBackendError(mode: AuthMode, payload: { error?: string; details?: string[] }) {
  if (payload.details?.length) return payload.details.join(", ");
  if (payload.error) return payload.error;
  return mode === "register" ? "Unable to create account. Email may already be registered." : "Unable to sign in. Check your email and password.";
}
