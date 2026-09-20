using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260920050000_SecureOnboardingAndSupport")]
public partial class SecureOnboardingAndSupport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "MustChangePassword",
            table: "Users",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.DropIndex("IX_Users_Email", "Users");
        migrationBuilder.CreateIndex(
            name: "IX_Users_TenantId_Email",
            table: "Users",
            columns: new[] { "TenantId", "Email" },
            unique: true);

        migrationBuilder.CreateTable(
            name: "TenantInvites",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                TenantId = table.Column<int>(type: "integer", nullable: false),
                UserId = table.Column<int>(type: "integer", nullable: false),
                TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                HostSubdomain = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedByUserId = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TenantInvites", x => x.Id);
                table.ForeignKey("FK_TenantInvites_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_TenantInvites_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "SupportSessions",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                TenantId = table.Column<int>(type: "integer", nullable: false),
                PlatformUserId = table.Column<int>(type: "integer", nullable: false),
                Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ReadOnly = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SupportSessions", x => x.Id);
                table.ForeignKey("FK_SupportSessions_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_SupportSessions_Users_PlatformUserId", x => x.PlatformUserId, "Users", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("IX_TenantInvites_TokenHash", "TenantInvites", "TokenHash", unique: true);
        migrationBuilder.CreateIndex("IX_TenantInvites_TenantId_UserId_ExpiresAt", "TenantInvites", new[] { "TenantId", "UserId", "ExpiresAt" });
        migrationBuilder.CreateIndex("IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt", "SupportSessions", new[] { "TenantId", "PlatformUserId", "ExpiresAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("TenantInvites");
        migrationBuilder.DropTable("SupportSessions");
        migrationBuilder.DropIndex("IX_Users_TenantId_Email", "Users");
        migrationBuilder.CreateIndex("IX_Users_Email", "Users", "Email", unique: true);
        migrationBuilder.DropColumn("MustChangePassword", "Users");
    }
}
