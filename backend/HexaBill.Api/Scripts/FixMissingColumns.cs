/*
 * One-time script to fix missing database columns
 * Run this via a controller endpoint or manually
 */
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Scripts
{
    public static class FixMissingColumns
    {
        public static async Task FixAsync(DbContext context)
        {
            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                // Add missing columns using raw SQL (SQLite-safe)
                var commands = new[]
                {
                    "ALTER TABLE Sales ADD COLUMN LastPaymentDate TEXT NULL",
                    "ALTER TABLE Sales ADD COLUMN PaidAmount decimal(18,2) DEFAULT 0",
                    "ALTER TABLE Sales ADD COLUMN TotalAmount decimal(18,2) DEFAULT 0",
                    "ALTER TABLE Customers ADD COLUMN LastActivity TEXT NULL",
                    "ALTER TABLE Payments ADD COLUMN Reference TEXT NULL",
                    "ALTER TABLE Payments ADD COLUMN CreatedBy INTEGER DEFAULT 1",
                    "ALTER TABLE Payments ADD COLUMN UpdatedAt TEXT NULL",
                    "UPDATE Sales SET TotalAmount = GrandTotal WHERE TotalAmount = 0 OR TotalAmount IS NULL",
                    "UPDATE Sales SET PaidAmount = 0 WHERE PaidAmount IS NULL",
                    "CREATE INDEX IF NOT EXISTS IX_Payments_CreatedBy ON Payments(CreatedBy)"
                };

                foreach (var command in commands)
                {
                    try
                    {
                        await context.Database.ExecuteSqlRawAsync(command);
                    }
                    catch (Exception ex)
                    {
                        // Ignore errors if column/index already exists
                        Console.WriteLine($"⚠️ Command failed (may already exist): {command}");
                        Console.WriteLine($"   Error: {ex.Message}");
                    }
                }

                Console.WriteLine("✅ Missing columns fixed successfully");
            }
            finally
            {
                await connection.CloseAsync();
            }
        }
    }
}

