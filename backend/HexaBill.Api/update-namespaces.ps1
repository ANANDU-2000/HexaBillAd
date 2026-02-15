# HexaBill Namespace Update Script
# Legacy script - namespaces already updated to HexaBill.Api.*

$modules = @{
    "Auth" = "Auth"
    "Billing" = "Billing"
    "Customers" = "Customers"
    "Inventory" = "Inventory"
    "Purchases" = "Purchases"
    "Payments" = "Payments"
    "Expenses" = "Expenses"
    "Reports" = "Reports"
    "Notifications" = "Notifications"
    "Users" = "Users"
    "SuperAdmin" = "SuperAdmin"
}

# Update Modules
foreach ($module in $modules.Keys) {
    $modulePath = "Modules\$module"
    $namespace = "HexaBill.Api.Modules.$($modules[$module])"
    
    Get-ChildItem -Path $modulePath -Filter *.cs -Recurse | ForEach-Object {
        $content = Get-Content $_.FullName -Raw -Encoding UTF8
        $original = $content
        
        # Update namespace
        $content = $content -replace 'namespace FrozenApi\.Controllers', "namespace $namespace"
        $content = $content -replace 'namespace FrozenApi\.Services', "namespace $namespace"
        $content = $content -replace 'namespace FrozenApi\.Modules\.' + $module, "namespace $namespace"
        
        # Update using statements
        $content = $content -replace 'using FrozenApi\.Data;', 'using HexaBill.Api.Data;'
        $content = $content -replace 'using FrozenApi\.Models;', 'using HexaBill.Api.Models;'
        $content = $content -replace 'using FrozenApi\.Services;', "using $namespace;"
        $content = $content -replace 'using FrozenApi\.Controllers;', "using $namespace;"
        $content = $content -replace 'using FrozenApi\.Helpers', 'using HexaBill.Api.Shared.Extensions'
        $content = $content -replace 'using FrozenApi\.Middleware', 'using HexaBill.Api.Shared.Middleware'
        
        if ($content -ne $original) {
            Set-Content -Path $_.FullName -Value $content -Encoding UTF8 -NoNewline
            Write-Host "Updated: $($_.Name)"
        }
    }
}

# Update Shared
Get-ChildItem -Path "Shared" -Filter *.cs -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    $original = $content
    
    $folder = $_.Directory.Name
    $namespace = switch ($folder) {
        "Middleware" { "HexaBill.Api.Shared.Middleware" }
        "Extensions" { "HexaBill.Api.Shared.Extensions" }
        "Security" { "HexaBill.Api.Shared.Security" }
        "Validation" { "HexaBill.Api.Shared.Validation" }
        default { "HexaBill.Api.Shared.$folder" }
    }
    
    $content = $content -replace 'namespace FrozenApi\.Middleware', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Helpers', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Services', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Shared\.Middleware', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Shared\.Extensions', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Shared\.Security', "namespace $namespace"
    $content = $content -replace 'namespace FrozenApi\.Shared\.Validation', "namespace $namespace"
    
    $content = $content -replace 'using FrozenApi\.Data;', 'using HexaBill.Api.Data;'
    $content = $content -replace 'using FrozenApi\.Models;', 'using HexaBill.Api.Models;'
    $content = $content -replace 'using FrozenApi\.Helpers', 'using HexaBill.Api.Shared.Extensions'
    $content = $content -replace 'using FrozenApi\.Middleware', 'using HexaBill.Api.Shared.Middleware'
    
    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Updated: $($_.Name)"
    }
}

Write-Host "`nNamespace update complete!"
