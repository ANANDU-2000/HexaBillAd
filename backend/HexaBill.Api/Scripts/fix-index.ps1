# Execute SQL fix on Render PostgreSQL

$env:PGPASSWORD = "Py1juETYf6BUWT8AApFfU0vq6LTQ5bvB"
$dbHost = "dpg-d571muur433s73eecebg-a.singapore-postgres.render.com"
$user = "hexabilldb_user"
$db = "hexabilldb"

Write-Host "Dropping old index..." -ForegroundColor Yellow
psql -h $dbHost -U $user -d $db -c 'DROP INDEX IF EXISTS "IX_Sales_InvoiceNo";'

Write-Host "`nCreating new composite index..." -ForegroundColor Yellow
psql -h $dbHost -U $user -d $db -c 'CREATE UNIQUE INDEX "IX_Sales_OwnerId_InvoiceNo" ON "Sales" ("OwnerId", "InvoiceNo") WHERE "IsDeleted" = false;'

Write-Host "`nVerifying index..." -ForegroundColor Green
psql -h $dbHost -U $user -d $db -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'Sales' AND indexname = 'IX_Sales_OwnerId_InvoiceNo';"

Write-Host "`nChecking for duplicates within same owner..." -ForegroundColor Green
psql -h $dbHost -U $user -d $db -c "SELECT ""InvoiceNo"", ""OwnerId"", COUNT(*) as count FROM ""Sales"" WHERE ""IsDeleted"" = false GROUP BY ""InvoiceNo"", ""OwnerId"" HAVING COUNT(*) > 1;"

Write-Host "`n✅ DONE" -ForegroundColor Green
