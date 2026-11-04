import React, { useState } from 'react';
import { Lock, Mail, Sparkles, User, Zap } from 'lucide-react';
import { CheckerDivider } from '../components/Poster/CheckerDivider';
import { PrimaryPillButton } from '../components/Poster/PrimaryPillButton';
import { TitleHero } from '../components/Poster/TitleHero';
import { useAuth } from '../contexts/AuthContext';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoAccount = async () => {
    setError(null);
    setSubmitting(true);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const demoEmail = `criador${randomSuffix}@vibetrack.app`;
    try {
      await register('Assinante VibeTrack', demoEmail, 'vibetrack123');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta de teste.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-poster-cream text-poster-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-5 pb-12 pt-4">
        {/* 1. Faixa xadrez no topo */}
        <CheckerDivider />

        {/* 2. Cabeçalho Retrô */}
        <header className="flex items-center justify-between pt-3">
          <span className="font-display text-lg font-black uppercase tracking-tight text-poster-red">
            VIBETRACK
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-poster-ink">
            Nº 01 · EDIÇÃO FOTO
          </span>
        </header>

        {/* 3. Título Hero */}
        <TitleHero
          line1="QUAL É"
          line2="A FOTO?"
          subtitle="Identifique-se para revelar a trilha sonora perfeita das suas fotos."
        />

        {/* Seletor de Modo em Pílulas Retrô */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-full border-2 border-poster-red bg-poster-paper p-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`min-h-[42px] rounded-full font-display text-xs uppercase tracking-wider transition ${
              mode === 'register'
                ? 'bg-poster-red text-poster-cream shadow-sm'
                : 'text-poster-ink hover:text-poster-red'
            }`}
          >
            Criar Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`min-h-[42px] rounded-full font-display text-xs uppercase tracking-wider transition ${
              mode === 'login'
                ? 'bg-poster-red text-poster-cream shadow-sm'
                : 'text-poster-ink hover:text-poster-red'
            }`}
          >
            Já Sou Assinante
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border-2 border-poster-red bg-poster-redLight p-3 text-xs font-bold text-poster-ink"
          >
            {error}
          </div>
        )}

        {/* Formulário de Acesso / Cadastro Obrigatório (RF-001) */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[26px] border-2 border-poster-ink bg-poster-paper p-5 shadow-polaroid"
        >
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
                SEU NOME / CODINOME
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-poster-red" />
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Mariana Araujo"
                  className="min-h-[44px] w-full rounded-full border border-poster-border bg-poster-cream py-2.5 pl-10 pr-4 text-sm font-medium text-poster-ink placeholder-poster-muted focus:border-poster-red focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
              E-MAIL DE ACESSO
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-poster-red" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="min-h-[44px] w-full rounded-full border border-poster-border bg-poster-cream py-2.5 pl-10 pr-4 text-sm font-medium text-poster-ink placeholder-poster-muted focus:border-poster-red focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
              SENHA (MÍN. 6 CARACTERES)
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-poster-red" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="min-h-[44px] w-full rounded-full border border-poster-border bg-poster-cream py-2.5 pl-10 pr-4 text-sm font-medium text-poster-ink placeholder-poster-muted focus:border-poster-red focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-1">
            <PrimaryPillButton
              type="submit"
              disabled={submitting}
              icon={<Sparkles className="h-4 w-4" />}
            >
              {submitting
                ? 'AUTENTICANDO...'
                : mode === 'register'
                ? 'ENTRAR NA EDIÇÃO'
                : 'ACESSAR MINHA CONTA'}
            </PrimaryPillButton>
          </div>
        </form>

        <CheckerDivider className="my-5" />

        {/* Acesso Rápido Demo em 1 Clique */}
        <div className="space-y-2">
          <PrimaryPillButton
            variant="outline"
            disabled={submitting}
            onClick={handleQuickDemoAccount}
            icon={<Zap className="h-4 w-4" />}
          >
            ACESSO RÁPIDO DEMO (1 CLIQUE)
          </PrimaryPillButton>
          <p className="text-center text-[10px] uppercase tracking-wider text-poster-muted">
            Conta identificada obrigatória • Uso ilimitado de análises
          </p>
        </div>
      </div>
    </div>
  );
};
