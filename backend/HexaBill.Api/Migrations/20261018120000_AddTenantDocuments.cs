using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Adds TenantDocuments and TenantDocumentVersions (company files: metadata, versions, review status). Hand-written and
/// idempotent (IF NOT EXISTS), PostgreSQL only, in line with the other recent migrations; the EF model snapshot is not
/// regenerated because it carries unrelated SQLite drift. Not applied to any database by this change. A production run
/// needs the usual approval, backup and rehearsal, and the tables must be owned by the application role.
/// Down drops only the two tables this migration adds.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261018120000_AddTenantDocuments")]
public class AddTenantDocuments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""TenantDocuments"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" integer NOT NULL,
    ""Title"" character varying(200) NOT NULL,
    ""DocType"" character varying(20) NOT NULL,
    ""Visibility"" character varying(20) NOT NULL,
    ""Status"" character varying(20) NOT NULL,
    ""CurrentVersionId"" uuid NULL,
    ""CreatedByUserId"" integer NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    ""DeletedAt"" timestamp with time zone NULL,
    CONSTRAINT ""PK_TenantDocuments"" PRIMARY KEY (""Id"")
);");
        migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_TenantDocuments_TenantId_Status\" ON \"TenantDocuments\" (\"TenantId\", \"Status\");");
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""TenantDocumentVersions"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" integer NOT NULL,
    ""DocumentId"" uuid NOT NULL,
    ""VersionNumber"" integer NOT NULL,
    ""OriginalFileName"" character varying(200) NOT NULL,
    ""ContentType"" character varying(100) NOT NULL,
    ""SizeBytes"" bigint NOT NULL,
    ""Sha256"" character varying(64) NOT NULL,
    ""StorageKey"" character varying(300) NOT NULL,
    ""Status"" character varying(20) NOT NULL,
    ""ExpiresOn"" timestamp with time zone NULL,
    ""UploadedByUserId"" integer NOT NULL,
    ""UploadedAt"" timestamp with time zone NOT NULL,
    ""ReviewedByUserId"" integer NULL,
    ""ReviewedAt"" timestamp with time zone NULL,
    CONSTRAINT ""PK_TenantDocumentVersions"" PRIMARY KEY (""Id"")
);");
        migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_TenantDocumentVersions_TenantId_DocumentId_VersionNumber\" ON \"TenantDocumentVersions\" (\"TenantId\", \"DocumentId\", \"VersionNumber\");");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("DROP TABLE IF EXISTS \"TenantDocumentVersions\";");
        migrationBuilder.Sql("DROP TABLE IF EXISTS \"TenantDocuments\";");
    }
}
