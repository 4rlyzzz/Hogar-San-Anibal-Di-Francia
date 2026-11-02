
param(
    [string]$ArchivoDatos = (Join-Path $PSScriptRoot "datos_actuales.json")
)

$CouchDB = "http://127.0.0.1:5984"

# Cada tipo de documento vive en su base (igual que DBS en couchdb_service.py)
$DbPorTipo = @{
    usuario    = "casa_usuarios"
    producto   = "casa_inventario"
    donador    = "casa_donadores"
    movimiento = "casa_movimientos"
}
$Bases = @("casa_usuarios", "casa_inventario", "casa_donadores", "casa_movimientos")

Write-Host ""
Write-Host "===================================="
Write-Host "   CONFIGURACION CASA HOGAR"
Write-Host "===================================="
Write-Host ""

# ============================================
# CREDENCIALES
# ============================================

$AdminUser = Read-Host "Usuario administrador"

$AdminPasswordSecure = Read-Host "Contrasena administrador" -AsSecureString
$AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPasswordSecure)
)

$AppUser = "casa_app"

$AppPasswordSecure = Read-Host "Contrasena para casa_app" -AsSecureString
$AppPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AppPasswordSecure)
)

# ============================================
# AUTH HEADER
# ============================================

$AuthString = "$($AdminUser):$($AdminPassword)"

$AdminAuth = @{
    Authorization = "Basic " + `
    [Convert]::ToBase64String(
        [Text.Encoding]::UTF8.GetBytes($AuthString)
    )
}

# ============================================
# FUNCIONES
# ============================================

function Get-HttpStatus {

    param($ErrorRecord)

    try {
        return [int]$ErrorRecord.Exception.Response.StatusCode
    }
    catch {
        return 0
    }
}

function Ensure-Database {

    param($DbName)

    Write-Host ""
    Write-Host "Comprobando $DbName ..."

    try {

        Invoke-RestMethod `
            -Uri "$CouchDB/$DbName" `
            -Headers $AdminAuth `
            -Method Get | Out-Null

        Write-Host "$DbName ya existe."

    }
    catch {

        Write-Host "$DbName no existe."
        Write-Host "Creando..."

        try {

            Invoke-RestMethod `
                -Uri "$CouchDB/$DbName" `
                -Headers $AdminAuth `
                -Method Put | Out-Null

            Write-Host "$DbName creada."

        }
        catch {

            Write-Host "ERROR creando $DbName"
            Write-Host $_.Exception.Message
            exit 1
        }
    }
}

# ============================================
# [1/8] COUCHDB
# ============================================

Write-Host ""
Write-Host "[1/8] Comprobando CouchDB..."

try {

    Invoke-RestMethod `
        -Uri "$CouchDB/" `
        -Headers $AdminAuth `
        -Method Get | Out-Null

    Write-Host "CouchDB encontrado."

}
catch {

    Write-Host "ERROR conectando a CouchDB"
    Write-Host $_.Exception.Message
    exit 1
}

# ============================================
# [2/8] SISTEMA
# ============================================

Write-Host ""
Write-Host "[2/8] Bases internas..."

Ensure-Database "_users"
Ensure-Database "_replicator"
Ensure-Database "_global_changes"

# ============================================
# [3/8] BASES DE LA APLICACION
# ============================================

Write-Host ""
Write-Host "[3/8] Bases de la aplicacion..."

foreach ($Db in $Bases) {
    Ensure-Database $Db
}

# ============================================
# [4/8] USUARIO
# ============================================

Write-Host ""
Write-Host "[4/8] Usuario casa_app..."

$UserId = "org.couchdb.user:$AppUser"

$UserBody = @{
    name = $AppUser
    password = $AppPassword
    roles = @()
    type = "user"
} | ConvertTo-Json

try {

    Invoke-RestMethod `
        -Uri "$CouchDB/_users/$UserId" `
        -Headers $AdminAuth `
        -Method Put `
        -ContentType "application/json" `
        -Body $UserBody | Out-Null

    Write-Host "Usuario creado."

}
catch {

    if ((Get-HttpStatus $_) -eq 409) {
        Write-Host "Usuario ya existe (se conserva su contrasena actual)."
    }
    else {
        Write-Host "ERROR creando usuario:"
        Write-Host $_.Exception.Message
    }
}

# ============================================
# [5/8] PERMISOS (solo casa_app como miembro)
# ============================================

Write-Host ""
Write-Host "[5/8] Permisos..."

$SecurityBody = @{
    admins = @{
        names = @()
        roles = @()
    }
    members = @{
        names = @($AppUser)
        roles = @()
    }
} | ConvertTo-Json -Depth 5

foreach ($Db in $Bases) {

    try {

        Invoke-RestMethod `
            -Uri "$CouchDB/$Db/_security" `
            -Headers $AdminAuth `
            -Method Put `
            -ContentType "application/json" `
            -Body $SecurityBody | Out-Null

        Write-Host "$Db : permisos configurados."

    }
    catch {

        # Sin permisos una base queda abierta a cualquier usuario valido: se detiene
        Write-Host "ERROR configurando permisos en $Db"
        Write-Host $_.Exception.Message
        exit 1
    }
}


# ============================================
# [6/8] INDICES
# ============================================

Write-Host ""
Write-Host "[6/8] Indices..."

$IndiceBody = '{"index": {"fields": ["tipo"]}, "name": "idx-tipo", "type": "json"}'

foreach ($Db in $Bases) {

    try {

        $Resp = Invoke-RestMethod `
            -Uri "$CouchDB/$Db/_index" `
            -Headers $AdminAuth `
            -Method Post `
            -ContentType "application/json" `
            -Body $IndiceBody

        Write-Host "$Db : indice idx-tipo ($($Resp.result))."

    }
    catch {

        Write-Host "ERROR creando indice en $Db"
        Write-Host $_.Exception.Message
        exit 1
    }
}

# ============================================
# [7/8] DATOS
# ============================================

Write-Host ""
Write-Host "[7/8] Datos iniciales..."

if (!(Test-Path $ArchivoDatos)) {
    Write-Host "ERROR: No existe:"
    Write-Host $ArchivoDatos
    exit 1
}

Write-Host "Archivo encontrado:"
Write-Host $ArchivoDatos

# En PowerShell 7 anterior a 7.5, ConvertFrom-Json convierte las fechas
# en texto ISO a objetos DateTime y al guardarlas cambia su formato.
$ParamsJson = @{}

if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
    $ParamsJson['DateKind'] = 'String'
}
elseif ($PSVersionTable.PSVersion.Major -ge 7) {
    Write-Host "ERROR: esta version de PowerShell cambiaria el formato de las fechas."
    Write-Host "Ejecuta el script con Windows PowerShell 5.1 (powershell.exe) o con PowerShell 7.5 o superior."
    exit 1
}


$Crudo = Get-Content $ArchivoDatos -Raw -Encoding UTF8
$Datos = $Crudo | ConvertFrom-Json @ParamsJson

if ($Datos -is [System.Array]) {
    $Docs = $Datos
}
elseif ($Datos.PSObject.Properties.Name -contains 'docs') {
    $Docs = $Datos.docs
}
elseif ($Datos.PSObject.Properties.Name -contains 'rows') {
    $Docs = $Datos.rows | ForEach-Object { $_.doc }
}
elseif ($Datos.PSObject.Properties.Name -contains '_id') {
    $Docs = @($Datos)
}
else {
    Write-Host "ERROR: no se reconoce el formato del archivo de datos."
    exit 1
}

# Reparte los documentos segun su tipo
$PorBase = @{}
foreach ($Db in $Bases) {
    $PorBase[$Db] = New-Object System.Collections.ArrayList
}

$Omitidos = 0

foreach ($Doc in $Docs) {

    if ($null -eq $Doc) { continue }

    $Id = [string]$Doc._id

    # Los indices ya los crea este script
    if ($Id.StartsWith("_design/")) { continue }

    $Tipo = [string]$Doc.tipo

    if (-not $DbPorTipo.ContainsKey($Tipo)) {
        $Omitidos++
        Write-Host "Omitido (tipo desconocido '$Tipo'): $Id"
        continue
    }

    # _rev se quita: la base nueva asigna sus propias revisiones
    if ($Doc.PSObject.Properties.Name -contains '_rev') {
        $Doc.PSObject.Properties.Remove('_rev')
    }

    [void]$PorBase[$DbPorTipo[$Tipo]].Add($Doc)
}

# Carga por lotes
$TamanoLote = 500
$TotalCargados = 0
$TotalErrores = 0

foreach ($Db in $Bases) {

    $Lista = $PorBase[$Db]
    $Cargados = 0
    $YaExistian = 0
    $Errores = 0

    for ($i = 0; $i -lt $Lista.Count; $i += $TamanoLote) {

        $Fin = [Math]::Min($i + $TamanoLote, $Lista.Count) - 1
        $Cuerpo = @{ docs = @($Lista[$i..$Fin]) } | ConvertTo-Json -Depth 20 -Compress
        $Bytes = [Text.Encoding]::UTF8.GetBytes($Cuerpo)

        try {

            $Resultado = Invoke-RestMethod `
                -Uri "$CouchDB/$Db/_bulk_docs" `
                -Headers $AdminAuth `
                -Method Post `
                -ContentType "application/json; charset=utf-8" `
                -Body $Bytes

        }
        catch {

            Write-Host ""
            Write-Host "ERROR cargando datos en $Db :"
            Write-Host $_.Exception.Message

            if ($_.ErrorDetails.Message) {
                Write-Host $_.ErrorDetails.Message
            }

            exit 1
        }

        foreach ($R in $Resultado) {

            if ($R.ok) {
                $Cargados++
            }
            elseif ($R.error -eq "conflict") {
                $YaExistian++
            }
            else {
                $Errores++
                if ($Errores -le 5) {
                    Write-Host "  Error en $($R.id): $($R.error) - $($R.reason)"
                }
            }
        }
    }

    Write-Host "$Db : $Cargados cargados, $YaExistian ya existian, $Errores con error."

    $TotalCargados += $Cargados
    $TotalErrores += $Errores
}

if ($Omitidos -gt 0) {
    Write-Host "Documentos omitidos por tipo desconocido: $Omitidos"
}

if ($TotalErrores -gt 0) {
    Write-Host ""
    Write-Host "ATENCION: hubo $TotalErrores documentos con error. Revisa los mensajes de arriba."
}

# ============================================
# [8/8] FINAL
# ============================================

Write-Host ""
Write-Host "===================================="
Write-Host "CONFIGURACION TERMINADA"
Write-Host "===================================="

Write-Host ""
Write-Host "Bases de datos:"
foreach ($Db in $Bases) {
    Write-Host "  - $Db"
}
Write-Host "Usuario: $AppUser"
Write-Host "Documentos cargados: $TotalCargados"
Write-Host ""
Write-Host "Siguiente paso: reinicia Django y recarga el navegador"
Write-Host "(las revisiones _rev de los documentos son nuevas)."
Write-Host ""