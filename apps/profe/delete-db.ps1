# Script para eliminar la base de datos
$dbPath = "$env:APPDATA\gestor-academico\database\gestor_academico.db"

Write-Host "Buscando base de datos en: $dbPath"

if (Test-Path $dbPath) {
    Write-Host "Archivo encontrado. Eliminando..."
    Remove-Item $dbPath -Force
    Write-Host "✅ Base de datos eliminada exitosamente"
} else {
    Write-Host "❌ Archivo no encontrado en la ruta esperada"
}

# Eliminar archivos relacionados
$walPath = "$dbPath-wal"
$shmPath = "$dbPath-shm"

if (Test-Path $walPath) {
    Remove-Item $walPath -Force
    Write-Host "✅ Archivo WAL eliminado"
}

if (Test-Path $shmPath) {
    Remove-Item $shmPath -Force
    Write-Host "✅ Archivo SHM eliminado"
}

Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
