using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <summary>
    /// Backward-compatible: ensures Settings has column "Value" (PascalCase) for EF Core / Npgsql.
    /// If production has lowercase "value", renames it to "Value". No data loss.
    /// </summary>
    public partial class EnsureSettingsValueColumnPascalCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Settings' AND column_name = 'value'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Settings' AND column_name = 'Value'
  ) THEN
    ALTER TABLE ""Settings"" RENAME COLUMN value TO ""Value"";
  END IF;
END $$;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Settings' AND column_name = 'Value'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Settings' AND column_name = 'value'
  ) THEN
    ALTER TABLE ""Settings"" RENAME COLUMN ""Value"" TO value;
  END IF;
END $$;
");
        }
    }
}
