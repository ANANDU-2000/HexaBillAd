# Create a HexaBill tenant (client) and print link, tenant ID, email, and password.
# Requires: backend running at $BaseUrl (default http://localhost:5000).
# Usage: .\CreateTenantClient.ps1 [-TenantName "My Client"] [-Email "client@example.com"]

param(
    [string]$BaseUrl = "http://localhost:5000",
    [string]$TenantName = "Demo Client",
    [string]$Email = "client@hexabill-demo.com"
)

$loginBody = @{ email = "admin@hexabill.com"; password = "Admin123!" } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
} catch {
    Write-Error "Login failed. Is the backend running at $BaseUrl ? Error: $_"
    exit 1
}

if (-not $loginResp.success -or -not $loginResp.data.token) {
    Write-Error "Login response missing token. Response: $($loginResp | ConvertTo-Json -Depth 3)"
    exit 1
}

$token = $loginResp.data.token
$createBody = @{ name = $TenantName; email = $Email } | ConvertTo-Json
$headers = @{ Authorization = "Bearer $token" }

try {
    $createResp = Invoke-RestMethod -Uri "$BaseUrl/api/superadmin/Tenant" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
} catch {
    Write-Error "Create tenant failed. Error: $_"
    exit 1
}

if (-not $createResp.success) {
    Write-Error "Create tenant failed: $($createResp.message)"
    exit 1
}

$d = $createResp.data
# API may return { tenant, clientCredentials } (new) or tenant object directly (old)
$cred = $d.clientCredentials
if (-not $cred) { $cred = $d.ClientCredentials }
$t = $d.tenant
if (-not $t) { $t = $d.Tenant }
if (-not $t) { $t = $d }

if ($cred) {
    $link = $cred.clientAppLink; if (-not $link) { $link = $cred.ClientAppLink }
    $tid = $cred.tenantId; if ($null -eq $tid) { $tid = $cred.TenantId }
    $em = $cred.email; if (-not $em) { $em = $cred.Email }
    $pw = $cred.password; if (-not $pw) { $pw = $cred.Password }
} else {
    $link = "http://localhost:5176"
    $tid = $t.id; if (-not $tid) { $tid = $t.Id }
    $em = $t.email; if (-not $em) { $em = $t.Email }
    $pw = "Owner123!"
}

Write-Host ""
Write-Host "========== CLIENT CREDENTIALS (give these to the client) ==========" -ForegroundColor Green
Write-Host "  Link:      $link"
Write-Host "  Tenant ID: $tid"
Write-Host "  Email:     $em"
Write-Host "  Password:  $pw"
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
