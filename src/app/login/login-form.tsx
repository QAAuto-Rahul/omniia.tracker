"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail, isValidEmail, normalizeEmail } from "@/lib/auth-domain";
import { requestOtp, verifyOtp } from "@/lib/auth-actions";

export function LoginForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function sendCode(target: string) {
    setError(null);
    startTransition(async () => {
      const res = await requestOtp(target);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail(target);
      setCode("");
      setStep("code");
      setCooldown(res.resendSeconds);
    });
  }

  function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    let value = normalizeEmail(email);
    // Let people type just their username.
    if (value && !value.includes("@")) value = `${value}@${ALLOWED_EMAIL_DOMAIN}`;
    if (!isValidEmail(value)) return setError("Enter a valid email address.");
    if (!isAllowedEmail(value)) return setError(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in.`);
    sendCode(value);
  }

  function submitCode(value: string) {
    if (value.length !== 6) return;
    setError(null);
    startTransition(async () => {
      // On success the action redirects into the portal.
      const res = await verifyOtp(email, value);
      if (res && !res.ok) {
        setError(res.error);
        setCode("");
      }
    });
  }

  return (
    <Card className="relative w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <BrandMark className="mx-auto mb-2 size-10" />
        <CardTitle className="text-lg">
          {step === "email" ? "Sign in to Omniia Tracker" : "Check your email"}
        </CardTitle>
        <CardDescription>
          {step === "email" ? (
            <>We&apos;ll email you a one-time code. Only @{ALLOWED_EMAIL_DOMAIN} accounts are allowed.</>
          ) : (
            <>
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === "email" ? (
          <form onSubmit={onEmailSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                disabled={pending}
                className="h-9"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={pending || !email.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : <Mail />}
              Send login code
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCode(code);
            }}
            className="grid gap-4"
          >
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                onComplete={submitCode}
                pattern="^[0-9]*$"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={pending}
                aria-invalid={!!error}
              >
                <InputOTPGroup>
                  {[0, 1, 2].map((i) => (
                    <InputOTPSlot key={i} index={i} className="size-10 text-base" />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="size-10 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
              {pending && <Loader2 className="animate-spin" />}
              Verify &amp; sign in
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setCode("");
                }}
              >
                <ArrowLeft /> Change email
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={pending || cooldown > 0}
                onClick={() => sendCode(email)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
