# ============================================
# CASA HOGAR - CONFIGURACION AUTOMATICA
# ============================================

$CouchDB = "http://127.0.0.1:5984"
$Database = "casa_hogar"

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
# FUNCION PARA CREAR BD SI NO EXISTE
# ============================================

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
# [1/7] COUCHDB
# ============================================

Write-Host ""
Write-Host "[1/7] Comprobando CouchDB..."

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
# [2/7] SISTEMA
# ============================================

Write-Host ""
Write-Host "[2/7] Bases internas..."

Ensure-Database "_users"
Ensure-Database "_replicator"
Ensure-Database "_global_changes"

# ============================================
# [3/7] CASA_HOGAR
# ============================================

Write-Host ""
Write-Host "[3/7] Base principal..."

Ensure-Database $Database

# ============================================
# [4/7] USUARIO
# ============================================

Write-Host ""
Write-Host "[4/7] Usuario casa_app..."

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
        -Body $UserBody

    Write-Host "Usuario creado."

}
catch {

    Write-Host "Usuario ya existe o error."
}

# ============================================
# [5/7] PERMISOS
# ============================================

Write-Host ""
Write-Host "[5/7] Permisos..."

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

try {

    Invoke-RestMethod `
        -Uri "$CouchDB/$Database/_security" `
        -Headers $AdminAuth `
        -Method Put `
        -ContentType "application/json" `
        -Body $SecurityBody

    Write-Host "Permisos configurados."

}
catch {

    Write-Host "Error configurando permisos."
}

# ============================================
# [6/7] DATOS
# ============================================

Write-Host ""
Write-Host "[6/7] Datos iniciales..."

$JsonPath = Join-Path $PSScriptRoot "datos_actuales.json"

if (!(Test-Path $JsonPath)) {
    Write-Host "ERROR: No existe:"
    Write-Host $JsonPath
    exit 1
}

Write-Host "Archivo encontrado:"
Write-Host $JsonPath

$Datos = Get-Content $JsonPath -Raw -Encoding UTF8

try {

    $Resultado = Invoke-RestMethod `
        -Uri "$CouchDB/$Database/_bulk_docs" `
        -Headers $AdminAuth `
        -Method Post `
        -ContentType "application/json" `
        -Body $Datos

    Write-Host ""
    Write-Host "Respuesta de CouchDB:"

    $Resultado | Format-Table

    Write-Host ""
    Write-Host "Datos enviados."

}
catch {

    Write-Host ""
    Write-Host "ERROR cargando datos:"
    Write-Host $_.Exception.Message

    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Respuesta de CouchDB:"
        Write-Host $_.ErrorDetails.Message
    }

    exit 1
}

# ============================================
# [7/7] FINAL
# ============================================

Write-Host ""
Write-Host "===================================="
Write-Host "CONFIGURACION TERMINADA"
Write-Host "===================================="

Write-Host ""
Write-Host "Base de datos: $Database"
Write-Host "Usuario: $AppUser"
Write-Host ""