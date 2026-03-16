"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/component/ui/mobile/asset/logo.jpeg";
import { auth } from "@/repository";
import MobileWebShell from "@/component/mobile/MobileWebShell";

type ApiError = {
  message?: string;
};

type LoginPageMobileProps = {
  nextPath: string;
};

function readMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const msg = (err as ApiError).message;
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

function setCookie(name: string, value: string, days: number): void {
  const maxAge = days * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export default function LoginPageMobile({ nextPath }: LoginPageMobileProps) {
  const router = useRouter();

  const [username, setUsername] = React.useState<string>("");
  const [password, setPassword] = React.useState<string>("");
  const [showPassword, setShowPassword] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState<boolean>(false);

  const finishLogin = React.useCallback(
    (accessToken: string) => {
      setCookie("accessToken", accessToken, 7);
      setCookie("petugasAccessToken", accessToken, 7);
      setIsSuccess(true);
      window.setTimeout(() => {
        router.replace(nextPath);
      }, 650);
    },
    [router, nextPath],
  );

  const onLogin = React.useCallback(async () => {
    if (!username.trim() || !password.trim()) return;
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await auth.login({
        username: username.trim(),
        password: password.trim(),
      });

      finishLogin(res.accessToken);
    } catch (e: unknown) {
      setError(readMessage(e, "Login gagal"));
      setIsLoading(false);
    }
  }, [username, password, isLoading, finishLogin]);

  React.useEffect(() => {
    if (!isSuccess) return;
    setIsLoading(false);
  }, [isSuccess]);

  return (
    <MobileWebShell contentClassName="bg-[#f7f7f7]">
      <div className="relative min-h-full w-full overflow-hidden bg-[#f7f7f7]">
        <div className="pointer-events-none absolute -top-16 right-[-28px] h-[220px] w-[220px] rounded-full bg-emerald-200/70 blur-[1px]" />
        <div className="pointer-events-none absolute -bottom-24 left-[-52px] h-[250px] w-[250px] rounded-full bg-blue-200/60 blur-[1px]" />

        <div className="mx-auto flex min-h-[calc(100svh-56px)] w-full max-w-[430px] items-center px-4 py-6">
          <div className="w-full animate-[petugasIn_700ms_ease-out] rounded-[24px] border border-[#dbe5f2] bg-[#f7f7f7] p-5 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
            <div className="mx-auto mb-3 flex h-[88px] w-[88px] items-center justify-center rounded-[20px] bg-[#f7f7f7]">
              <div className="relative h-[110px] w-[110px]">
                <Image src={logo} alt="Logo" fill sizes="110px" className="object-contain" priority />
              </div>
            </div>

            <div className="text-center">
              <div className="text-[28px] font-extrabold tracking-[0.2px] text-slate-900">Azzahra Security</div>
              <div className="mt-1 text-[14px] font-medium text-slate-600">Masuk untuk mulai patroli dan aktivitas jaga</div>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (untuk login password)"
                autoCapitalize="none"
                className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-[14px] font-medium text-slate-900 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-400"
              />

              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 pr-10 text-[14px] font-medium text-slate-900 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                type="button"
                onClick={onLogin}
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-slate-900 text-[14px] font-extrabold tracking-[0.4px] text-white disabled:opacity-90 active:scale-[0.985]"
              >
                {isLoading ? "Memproses..." : "Masuk"}
              </button>

              {error ? <div className="pt-1 text-center text-[13px] font-semibold text-red-700">{error}</div> : null}
            </div>
          </div>
        </div>

        {isSuccess ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 px-6">
            <div className="w-[240px] animate-[petugasPop_350ms_ease-out] rounded-[20px] bg-[#f7f7f7] px-5 py-6 text-center shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-[16px] font-black text-white">
                OK
              </div>
              <div className="mt-3 text-[19px] font-extrabold text-slate-900">Login Berhasil</div>
              <div className="mt-1 text-[13px] font-semibold text-slate-600">Mengarahkan ke dashboard...</div>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes petugasIn {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes petugasPop {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </MobileWebShell>
  );
}
