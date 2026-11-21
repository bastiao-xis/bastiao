'use client';

import type { LoginResult } from '@bastiao/api-client';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';
import { setSession } from '../../lib/session';

type Step =
  | { kind: 'password' }
  | { kind: 'mfa'; mfaToken: string }
  | { kind: 'enroll'; mfaToken: string; secret?: string; qr?: string };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(result: LoginResult) {
    if (result.status === 'AUTHENTICATED') {
      setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      router.replace('/');
    } else if (result.status === 'MFA_REQUIRED') {
      setStep({ kind: 'mfa', mfaToken: result.mfaToken });
    } else {
      const { secret, otpauthUrl } = await api.auth.beginMfaEnrollment(result.mfaToken);
      setStep({
        kind: 'enroll',
        mfaToken: result.mfaToken,
        secret,
        qr: await QRCode.toDataURL(otpauthUrl),
      });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step.kind === 'password') await handle(await api.auth.login(email, password));
      else if (step.kind === 'mfa') await handle(await api.auth.verifyMfa(step.mfaToken, code));
      else await handle(await api.auth.confirmMfaEnrollment(step.mfaToken, code));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login card">
      <h1>Bastião · ERP</h1>
      <form onSubmit={submit}>
        {step.kind === 'password' && (
          <>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </>
        )}
        {step.kind === 'enroll' && (
          <>
            <p className="muted">
              Teu perfil exige verificação em duas etapas. Escaneie o código com um aplicativo
              autenticador (Google Authenticator, Microsoft Authenticator, Authy) e digite o código
              de 6 dígitos.
            </p>
            {step.qr && (
              <img src={step.qr} alt="QR code do autenticador" width={200} height={200} />
            )}
            <p className="muted">
              Ou digite a chave: <code>{step.secret}</code>
            </p>
          </>
        )}
        {step.kind !== 'password' && (
          <label>
            Código do autenticador
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {step.kind === 'password' ? 'Entrar' : 'Confirmar'}
        </button>
      </form>
    </div>
  );
}
