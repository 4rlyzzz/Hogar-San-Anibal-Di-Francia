# Pruebas de regresion: revisa que todo lo que ya funciona siga funcionando.
# Ejecutar desde la raiz del proyecto:   .\pruebas.ps1
# Solo pruebas, sin lint ni build:       .\pruebas.ps1 -Rapido
#
# No necesita CouchDB encendido ni toca la base real: el backend usa una CouchDB falsa en memoria.

param(
    [switch]$Rapido
)

$raiz = $PSScriptRoot
$resultados = @()

function Paso($nombre, $carpeta, [scriptblock]$comando) {
    Write-Host ""
    Write-Host "==> $nombre" -ForegroundColor Cyan
    Push-Location (Join-Path $raiz $carpeta)
    $inicio = Get-Date
    try {
        & $comando
        $ok = ($LASTEXITCODE -eq 0)
    } catch {
        Write-Host $_ -ForegroundColor Red
        $ok = $false
    } finally {
        Pop-Location
    }
    $segundos = [math]::Round(((Get-Date) - $inicio).TotalSeconds, 1)
    $script:resultados += [pscustomobject]@{ Paso = $nombre; Resultado = $(if ($ok) { 'OK' } else { 'FALLO' }); Segundos = $segundos }
}

# python del entorno virtual (si no existe, el del sistema)
$python = Join-Path $raiz ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { $python = "python" }

# credenciales falsas: las pruebas nunca deben poder conectarse a la CouchDB real
# (las variables ya puestas tienen prioridad sobre el .env)
$env:COUCHDB_URL = "http://127.0.0.1:9"
$env:COUCHDB_USER = "pruebas"
$env:COUCHDB_PASSWORD = "pruebas"
$env:PYTHONWARNINGS = "ignore"

Paso "Backend: revision de Django" "backend" { & $python manage.py check }
Paso "Backend: pruebas (API, movimientos, usuarios, comandos)" "backend" { & $python manage.py test api }

if (-not (Test-Path (Join-Path $raiz "frontend\node_modules"))) {
    Paso "Frontend: instalar dependencias" "frontend" { npm install --no-audit --no-fund }
}
Paso "Frontend: pruebas (validacion, lotes, alertas, filtros, dictado)" "frontend" { npm test --silent }

if (-not $Rapido) {
    Paso "Frontend: lint" "frontend" { npm run lint --silent }
    Paso "Frontend: build" "frontend" { npm run build --silent }
}

Write-Host ""
Write-Host "==================== RESUMEN ====================" -ForegroundColor Cyan
$resultados | Format-Table -AutoSize | Out-String | Write-Host

$fallos = @($resultados | Where-Object { $_.Resultado -ne 'OK' })
if ($fallos.Count -gt 0) {
    Write-Host "FALLARON $($fallos.Count) paso(s). Revisa el detalle arriba antes de subir los cambios." -ForegroundColor Red
    exit 1
}
Write-Host "Todo bien: ninguna funcionalidad se rompio." -ForegroundColor Green
exit 0
