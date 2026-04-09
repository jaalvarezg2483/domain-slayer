import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getElectronAuth } from '@/lib/electron-auth';
import { cn } from '@/lib/utils';

type Props = {
  onSuccess: () => void | Promise<void>;
};

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await getElectronAuth().login({ email, password });
      await onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-25"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--primary) / 0.22), transparent),
            radial-gradient(ellipse 60% 40% at 100% 0%, hsl(214 72% 45% / 0.12), transparent),
            radial-gradient(ellipse 50% 30% at 0% 100%, hsl(214 60% 50% / 0.1), transparent)
          `,
        }}
      />
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <aside
          className={cn(
            'relative flex flex-col justify-between px-8 py-10 sm:px-12 lg:w-[min(44vw,520px)] lg:shrink-0 lg:py-14',
            'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white',
            'border-b border-white/10 lg:border-b-0 lg:border-r',
          )}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.04%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-90"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
                <BookOpen className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">Gestor Académico</p>
                <p className="text-xs font-medium uppercase tracking-widest text-white/50">Profesores</p>
              </div>
            </div>
            <h1 className="mt-8 max-w-sm text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
              Tu aula digital, ordenada y a mano.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              Cursos, evaluaciones, alumnos e instituciones en una sola aplicación pensada para el día a día en el
              aula.
            </p>
          </div>
          <p className="relative mt-10 text-xs text-white/45 lg:mt-0">Versión de escritorio · datos en tu equipo</p>
        </aside>

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <Card className="w-full max-w-[420px] border-border/80 shadow-[var(--shadow-card)] dark:shadow-none dark:border-border">
            <CardHeader className="space-y-1 pb-4 text-center sm:text-left">
              <CardTitle className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</CardTitle>
              <CardDescription className="text-base">
                Ingresa con el correo y la contraseña de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:bg-destructive/15"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nombre@ejemplo.com"
                      className="h-11 pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Contraseña
                    </Label>
                    <Link
                      to="/recuperar"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      ¿La olvidaste?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-11 pl-10 pr-11"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full text-base font-semibold shadow-sm" disabled={pending}>
                  {pending ? 'Entrando…' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-8 max-w-[420px] text-center text-xs text-muted-foreground">
            Al continuar aceptas usar esta aplicación según las políticas de tu institución.
          </p>
        </main>
      </div>
    </div>
  );
}
