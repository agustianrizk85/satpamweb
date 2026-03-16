"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { auth } from "@/repository";
import { Button, Card, CheckboxField, TextField } from "@/component/ui";

type LoginSuccess = {
  accessToken: string;
  user: unknown;
};

type Props = {
  nextPath: string;
};

function readCookie(name: string): string | null {
  const parts = document.cookie.split(";").map((value) => value.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    const value = decodeURIComponent(part.slice(name.length + 1)).trim();
    return value || null;
  }
  return null;
}

function setAccessTokenCookie(token: string, maxAgeSeconds: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

const COMPANY_SECTIONS = [
  {
    title: "VISI",
    description:
      "Menjadi perusahaan pengelola dan penyedia tenaga kerja andalan yang dapat memberikan pelayanan terbaik untuk pencapaian kepuasan pelanggan yang maksimal.",
  },
  {
    title: "MISI",
    description:
      "Melayani kebutuhan pengguna jasa sesuai standard pelayanan manajemen mutu dan menciptakan sumber daya manusia berintegritas tinggi yang sejahtera.",
  },
  {
    title: "MOTTO",
    description:
      "Serve and Integrity menjadi prinsip utama dengan kesejahteraan sebagai prioritas untuk menciptakan pelayanan prima.",
  },
] as const;

const SERVICES = [
  "Guard Service",
  "Facility Service",
  "Staff Supporting",
  "Pest Control",
  "Receptionist",
  "Cleaning Service",
  "Maintenance Engineer",
  "Industrial Warehouse",
] as const;

export default function LoginPage({ nextPath }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = readCookie("accessToken");
    if (!token) return;
    window.location.assign(nextPath);
  }, [nextPath]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = (await auth.login({ username, password })) as LoginSuccess;
      const token = response.accessToken?.trim() ?? "";
      if (!token) throw new Error("Login failed.");

      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      storage.setItem("accessToken", token);
      storage.setItem("authUser", JSON.stringify(response.user));

      const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 12;
      setAccessTokenCookie(token, maxAge);
      window.location.assign(nextPath);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.2),transparent_32%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.1),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-dvh max-w-7xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-[0_14px_28px_rgba(14,165,233,0.12)] backdrop-blur">
              <Sparkles className="h-4 w-4" />
              AZKACORPNEW 2
            </div>

            <div className="mt-6">
              <div className="inline-flex overflow-hidden rounded-[24px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                <Image
                  src="/azka.jpg"
                  alt="Azka Corp"
                  width={320}
                  height={64}
                  className="h-auto w-[220px] object-contain sm:w-[280px]"
                  priority
                />
              </div>
              <div className="mt-4">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Azzahra Trans Utama</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">EXPLORE AND PROTECTED YOUR BUSINESS</div>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              A business will develop if it is supported by a skilled and professional workforce, so we are here for you.
              Masuk ke panel admin untuk mengelola attendance, patroli, place, user, dan checklist facility dalam satu workspace.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {COMPANY_SECTIONS.map((item) => {
                return (
                  <div
                    key={item.title}
                    className="app-glass rounded-[24px] border border-white/70 p-4 shadow-[0_20px_40px_rgba(76,99,168,0.14)]"
                  >
                    <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                      {item.title}
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-900">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 app-glass rounded-[24px] border border-white/70 p-5 shadow-[0_20px_40px_rgba(76,99,168,0.14)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Layanan Kami</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {SERVICES.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-white/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.06)]"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <Card className="relative p-0">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_55%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_42%)]" />

            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 px-3 py-2 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                  <Image
                    src="/azka.jpg"
                    alt="Azka Corp Logo"
                    width={180}
                    height={36}
                    className="h-auto w-[110px] object-contain"
                    priority
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Azzahra Trans Utama</div>
                  <div className="text-base font-semibold text-slate-900">Admin Login</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure access
              </div>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900">Sign in to continue</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gunakan akun admin atau petugas yang sudah terdaftar untuk masuk ke sistem AZKACORPNEW 2.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4 text-sm">
                <TextField
                  type="text"
                  label="Email or Username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  required
                />

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold tracking-[0.01em] text-slate-800">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 pr-11 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none placeholder:text-slate-400 focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CheckboxField
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isSubmitting}
                    label="Remember me"
                  />
                  <span className="text-xs font-medium text-slate-500">Session tersimpan lebih lama jika opsi ini aktif.</span>
                </div>

                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <Button type="submit" disabled={isSubmitting} fullWidth className="h-12 gap-2 text-sm">
                  {isSubmitting ? "Signing in..." : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
