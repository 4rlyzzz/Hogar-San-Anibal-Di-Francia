# ============================================
# CONFIGURACIÓN AUTOMÁTICA DE CASA HOGAR
# ============================================

$CouchDB = "http://127.0.0.1:5984"
$Database = "casa_hogar"

Write-Host ""
Write-Host "============================================"
Write-Host "   CONFIGURACION DE CASA HOGAR"
Write-Host "============================================"
Write-Host ""


# ============================================
# DATOS DE ACCESO
# ============================================

$AdminUser = Read-Host "Usuario administrador de CouchDB"
$AdminPasswordSecure = Read-Host "Contraseña del administrador" -AsSecureString
$AdminPassword = $AdminPasswordSecure | ConvertFrom-SecureString -AsPlainText

$AppUser = "casa_app"

$AppPasswordSecure = Read-Host "Contraseña para $AppUser" -AsSecureString
$AppPassword = $AppPasswordSecure | ConvertFrom-SecureString -AsPlainText


# ============================================
# AUTENTICACION
# ============================================

$AdminAuth = @{
    Authorization = "Basic " + [Convert]::ToBase64String(
        [Text.Encoding]::ASCII.GetBytes(
            "${AdminUser}:${AdminPassword}"
        )
    )
}


# ============================================
# COMPROBAR COUCHDB
# ============================================

Write-Host ""
Write-Host "[1/6] Comprobando CouchDB..."

try {

    $response = Invoke-RestMethod `
        -Uri "$CouchDB/" `
        -Headers $AdminAuth `
        -Method Get

    Write-Host "CouchDB encontrado correctamente."

}
catch {

    Write-Host ""
    Write-Host "ERROR: No se pudo conectar con CouchDB."
    Write-Host "Verifica que CouchDB este iniciado."
    exit 1
}


# ============================================
# COMPROBAR BASE DE DATOS
# ============================================

Write-Host ""
Write-Host "[2/6] Comprobando base de datos $Database..."

try {

    Invoke-RestMethod `
        -Uri "$CouchDB/$Database" `
        -Headers $AdminAuth `
        -Method Get | Out-Null

    Write-Host "La base de datos ya existe."

}
catch {

    Write-Host "La base de datos no existe."
    Write-Host "Creando $Database..."

    try {

        Invoke-RestMethod `
            -Uri "$CouchDB/$Database" `
            -Headers $AdminAuth `
            -Method Put | Out-Null

        Write-Host "Base de datos creada."

    }
    catch {

        Write-Host "ERROR: No se pudo crear la base de datos."
        exit 1
    }
}


# ============================================
# CREAR USUARIO DE LA APLICACION
# ============================================

Write-Host ""
Write-Host "[3/6] Comprobando usuario $AppUser..."

$UserId = "org.couchdb.user:$AppUser"

$UserBody = @{
    _id = $UserId
    name = $AppUser
    type = "user"
    roles = @()
    password = $AppPassword
} | ConvertTo-Json

try {

    Invoke-RestMethod `
        -Uri "$CouchDB/_users/$UserId" `
        -Headers $AdminAuth `
        -Method Put `
        -ContentType "application/json" `
        -Body $UserBody | Out-Null

    Write-Host "Usuario $AppUser creado/actualizado."

}
catch {

    Write-Host "ERROR: No se pudo crear el usuario."
    Write-Host $_.Exception.Message
    exit 1
}


# ============================================
# CONFIGURAR PERMISOS
# ============================================

Write-Host ""
Write-Host "[4/6] Configurando permisos..."

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
        -Body $SecurityBody | Out-Null

    Write-Host "$AppUser agregado como miembro de $Database."

}
catch {

    Write-Host "ERROR: No se pudieron configurar los permisos."
    exit 1
}


# ============================================
# CARGAR DATOS INICIALES
# ============================================

Write-Host ""
Write-Host "[5/6] Cargando datos iniciales..."

$JsonPath = Join-Path $PSScriptRoot "datos_iniciales.json"

if (!(Test-Path $JsonPath)) {

    Write-Host "ERROR: No existe:"
    Write-Host $JsonPath
    exit 1
}


$Datos = Get-Content $JsonPath -Raw -Encoding UTF8


try {

    $Resultado = Invoke-RestMethod `
        -Uri "$CouchDB/$Database/_bulk_docs" `
        -Headers $AdminAuth `
        -Method Post `
        -ContentType "application/json" `
        -Body $Datos

    Write-Host "Datos iniciales enviados."

}
catch {

    Write-Host "ERROR: No se pudieron cargar los datos."
    Write-Host $_.Exception.Message
    exit 1
}


# ============================================
# FINAL
# ============================================

Write-Host ""
Write-Host "[6/6] Configuracion terminada."
Write-Host ""

Write-Host "============================================"
Write-Host "       CASA HOGAR LISTO"
Write-Host "============================================"
Write-Host ""

Write-Host "Base de datos:"
Write-Host "  $Database"

Write-Host ""

Write-Host "Usuario de aplicacion:"
Write-Host "  $AppUser"

Write-Host ""

Write-Host "Documentos iniciales cargados."

Write-Host ""