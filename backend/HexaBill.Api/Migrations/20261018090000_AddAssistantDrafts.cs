using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Adds AssistantDrafts (server-held proposed actions awaiting confirmation). Hand-written and idempotent
/// (IF NOT EXISTS), PostgreSQL only, in line with the other recent migrations; the EF model snapshot is not regenerated
/// because it carries unrelated SQLite drift. Not applied to any database by this change. A production run needs the
/// usual approval, backup and rehearsal. Down drops only the table this migration adds.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261018090000_AddAssistantDrafts")]
public class AddAssistantDrafts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""AssistantDrafts"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" integer NOT NULL,
    ""UserId"" integer NOT NULL,
    ""Kind"" character varying(40) NOT NULL,
    ""PayloadJson"" text NOT NULL,
    ""PayloadHash"" character varying(64) NOT NULL,
    ""Status"" character varying(20) NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""ExpiresAt"" timestamp with time zone NOT NULL,
    ""ConfirmedAt"" timestamp with time zone NULL,
    ""IdempotencyKey"" character varying(80) NULL,
    ""ResultJson"" text NULL,
    CONSTRAINT ""PK_AssistantDrafts"" PRIMARY KEY (""Id"")
);");
        migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_AssistantDrafts_TenantId_UserId_Status\" ON \"AssistantDrafts\" (\"TenantId\", \"UserId\", \"Status\");");
        migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_AssistantDrafts_TenantId_IdempotencyKey\" ON \"AssistantDrafts\" (\"TenantId\", \"IdempotencyKey\") WHERE \"IdempotencyKey\" IS NOT NULL;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("DROP TABLE IF EXISTS \"AssistantDrafts\";");
    }
}
