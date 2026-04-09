import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getElectronAuth } from '@/lib/electron-auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setPending(true);
    try {
      const res = await getElectronAuth().forgotPassword(email);
      setMessage(res.message || (res.emailSent ? 'Revisa tu correo.' : 'Solicitud registrada.'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al solicitar recuperación');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>
            Te enviaremos un código por correo si el servicio está configurado (Railway + Resend). Si no,
            un administrador puede restablecer tu contraseña en Usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="email">Correo de la cuenta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Volver al inicio de sesión
              </Link>
              {' · '}
              <Link to="/restablecer" className="text-primary underline-offset-4 hover:underline">
                Ya tengo un código
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
