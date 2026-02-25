/*
 * Design-time factory for EF Core migrations.
 * When ConnectionStrings__DefaultConnection contains "Host=" or "Server=", uses PostgreSQL (Npgsql).
 * Otherwise uses SQLite. Set the env var to generate PostgreSQL-only migrations.
 */
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Api.Data
{
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var conn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            if (string.IsNullOrWhiteSpace(conn))
            {
                var config = new ConfigurationBuilder()
                    .SetBasePath(Directory.GetCurrentDirectory())
                    .AddJsonFile("appsettings.json", optional: true)
                    .AddJsonFile("appsettings.Development.json", optional: true)
                    .Build();
                conn = config.GetConnectionString("DefaultConnection") ?? "Data Source=hexabill.db";
            }

            var usePg = conn.Contains("Host=", StringComparison.OrdinalIgnoreCase)
                || conn.Contains("Server=", StringComparison.OrdinalIgnoreCase);

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            if (usePg)
                optionsBuilder.UseNpgsql(conn);
            else
                optionsBuilder.UseSqlite(conn);

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
