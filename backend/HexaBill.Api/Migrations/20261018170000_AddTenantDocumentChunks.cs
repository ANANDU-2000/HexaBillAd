using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Adds TenantDocumentChunks (searchable passages of approved document versions) and the search columns on
/// TenantDocumentVersions. Hand-written and idempotent (IF NOT EXISTS), PostgreSQL only, like the other recent migrations; the EF
/// model snapshot is not regenerated because it carries unrelated SQLite drift. Runs after AddTenantDocuments. Not applied to any
/// database by this change; a production run needs the usual approval, backup and rehearsal, and the table must be owned by the
/// application role. Down drops the table and the three columns it adds.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261018170000_AddTenantDocumentChunks")]
public class AddTenantDocumentChunks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""TenantDocumentChunks"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" integer NOT NULL,
    ""DocumentId"" uuid NOT NULL,
    ""VersionId"" uuid NOT NULL,
    ""ChunkIndex"" integer NOT NULL,
    ""Location"" character varying(40) NOT NULL,
    ""Text"" text NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_TenantDocumentChunks"" PRIMARY KEY (""Id"")
);");
        migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_TenantDocumentChunks_TenantId_DocumentId_VersionId_ChunkIndex\" ON \"TenantDocumentChunks\" (\"TenantId\", \"DocumentId\", \"VersionId\", \"ChunkIndex\");");
        migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_TenantDocumentChunks_TenantId_VersionId\" ON \"TenantDocumentChunks\" (\"TenantId\", \"VersionId\");");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" ADD COLUMN IF NOT EXISTS \"SearchStatus\" character varying(20) NOT NULL DEFAULT 'None';");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" ADD COLUMN IF NOT EXISTS \"SearchNote\" character varying(300) NULL;");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" ADD COLUMN IF NOT EXISTS \"ChunkCount\" integer NOT NULL DEFAULT 0;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("DROP TABLE IF EXISTS \"TenantDocumentChunks\";");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" DROP COLUMN IF EXISTS \"SearchStatus\";");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" DROP COLUMN IF EXISTS \"SearchNote\";");
        migrationBuilder.Sql("ALTER TABLE \"TenantDocumentVersions\" DROP COLUMN IF EXISTS \"ChunkCount\";");
    }
}
