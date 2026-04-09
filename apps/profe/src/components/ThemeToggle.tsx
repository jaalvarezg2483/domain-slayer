import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, setStoredTheme, type ThemeMode } from '@/lib/theme';

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  function toggle() {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggle}
      title={mode === 'dark' ? 'Tema claro' : 'Tema oscuro'}
      aria-label={mode === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
    >
      {mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
