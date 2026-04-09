// Script alternativo para desarrollo
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando Gestor Académico en modo desarrollo...\n');

// Función para verificar si el servidor está listo
function waitForServer(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Timeout esperando servidor'));
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

// Iniciar Vite
console.log('📦 Iniciando servidor Vite...');
const vite = spawn('npm', ['run', 'dev:electron'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

// Esperar a que Vite esté listo
waitForServer('http://localhost:5173')
  .then(() => {
    console.log('\n✅ Servidor Vite listo!');
    console.log('⚡ Iniciando Electron...\n');
    
    const electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'development' }
    });

    electron.on('close', (code) => {
      console.log(`\n⚠️ Electron cerró con código ${code}`);
      vite.kill('SIGTERM');
      setTimeout(() => {
        vite.kill('SIGKILL');
        process.exit(code || 0);
      }, 2000);
    });

    electron.on('error', (err) => {
      console.error('Error iniciando Electron:', err);
      vite.kill('SIGTERM');
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Error esperando servidor:', err);
    vite.kill('SIGTERM');
    process.exit(1);
  });

vite.on('error', (err) => {
  console.error('Error iniciando Vite:', err);
  process.exit(1);
});

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Deteniendo servidores...');
  vite.kill('SIGTERM');
  setTimeout(() => {
    vite.kill('SIGKILL');
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  vite.kill('SIGTERM');
  process.exit(0);
});

