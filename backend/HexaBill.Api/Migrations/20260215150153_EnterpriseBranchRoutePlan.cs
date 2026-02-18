using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnterpriseBranchRoutePlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use idempotent SQL for PostgreSQL to prevent "column already exists" errors
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                // Routes.IsActive - try to add, catch and ignore "column already exists" errors (SQLSTATE 42701)
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Routes"" ADD COLUMN ""IsActive"" boolean NOT NULL DEFAULT false;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
                
                // Customers.BranchId
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Customers') AND LOWER(column_name)=LOWER('BranchId')) THEN
                            ALTER TABLE ""Customers"" ADD COLUMN ""BranchId"" integer NULL;
                        END IF;
                    END $$");
                
                // Customers.RouteId
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Customers') AND LOWER(column_name)=LOWER('RouteId')) THEN
                            ALTER TABLE ""Customers"" ADD COLUMN ""RouteId"" integer NULL;
                        END IF;
                    END $$");
                
                // Branches.IsActive - try to add, catch and ignore "column already exists" errors (SQLSTATE 42701)
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Branches"" ADD COLUMN ""IsActive"" boolean NOT NULL DEFAULT false;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
                
                // Branches.Location
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Branches') AND LOWER(column_name)=LOWER('Location')) THEN
                            ALTER TABLE ""Branches"" ADD COLUMN ""Location"" character varying(200) NULL;
                        END IF;
                    END $$");
                
                // Branches.ManagerId
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Branches') AND LOWER(column_name)=LOWER('ManagerId')) THEN
                            ALTER TABLE ""Branches"" ADD COLUMN ""ManagerId"" integer NULL;
                        END IF;
                    END $$");
                
                // Branches.ManagerUserId
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Branches') AND LOWER(column_name)=LOWER('ManagerUserId')) THEN
                            ALTER TABLE ""Branches"" ADD COLUMN ""ManagerUserId"" integer NULL;
                        END IF;
                    END $$");
                
                // Create indexes (idempotent)
                migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Customers_BranchId"" ON ""Customers"" (""BranchId"")");
                migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Customers_RouteId"" ON ""Customers"" (""RouteId"")");
                migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Branches_ManagerId"" ON ""Branches"" (""ManagerId"")");
                
                // Add foreign keys (idempotent)
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Branches_Users_ManagerId') THEN
                            ALTER TABLE ""Branches"" ADD CONSTRAINT ""FK_Branches_Users_ManagerId"" FOREIGN KEY (""ManagerId"") REFERENCES ""Users""(""Id"");
                        END IF;
                    END $$");
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Customers_Branches_BranchId') THEN
                            ALTER TABLE ""Customers"" ADD CONSTRAINT ""FK_Customers_Branches_BranchId"" FOREIGN KEY (""BranchId"") REFERENCES ""Branches""(""Id"");
                        END IF;
                    END $$");
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Customers_Routes_RouteId') THEN
                            ALTER TABLE ""Customers"" ADD CONSTRAINT ""FK_Customers_Routes_RouteId"" FOREIGN KEY (""RouteId"") REFERENCES ""Routes""(""Id"");
                        END IF;
                    END $$");
            }
            else
            {
                // SQLite - use standard AddColumn (will be caught by try-catch if exists)
                migrationBuilder.AddColumn<bool>(
                    name: "IsActive",
                    table: "Routes",
                    type: "INTEGER",
                    nullable: false,
                    defaultValue: false);

                migrationBuilder.AddColumn<int>(
                    name: "BranchId",
                    table: "Customers",
                    type: "INTEGER",
                    nullable: true);

                migrationBuilder.AddColumn<int>(
                    name: "RouteId",
                    table: "Customers",
                    type: "INTEGER",
                    nullable: true);

                migrationBuilder.AddColumn<bool>(
                    name: "IsActive",
                    table: "Branches",
                    type: "INTEGER",
                    nullable: false,
                    defaultValue: false);

                migrationBuilder.AddColumn<string>(
                    name: "Location",
                    table: "Branches",
                    type: "TEXT",
                    maxLength: 200,
                    nullable: true);

                migrationBuilder.AddColumn<int>(
                    name: "ManagerId",
                    table: "Branches",
                    type: "INTEGER",
                    nullable: true);

                migrationBuilder.AddColumn<int>(
                    name: "ManagerUserId",
                    table: "Branches",
                    type: "INTEGER",
                    nullable: true);

                migrationBuilder.CreateIndex(
                    name: "IX_Customers_BranchId",
                    table: "Customers",
                    column: "BranchId");

                migrationBuilder.CreateIndex(
                    name: "IX_Customers_RouteId",
                    table: "Customers",
                    column: "RouteId");

                migrationBuilder.CreateIndex(
                    name: "IX_Branches_ManagerId",
                    table: "Branches",
                    column: "ManagerId");

                migrationBuilder.AddForeignKey(
                    name: "FK_Branches_Users_ManagerId",
                    table: "Branches",
                    column: "ManagerId",
                    principalTable: "Users",
                    principalColumn: "Id");

                migrationBuilder.AddForeignKey(
                    name: "FK_Customers_Branches_BranchId",
                    table: "Customers",
                    column: "BranchId",
                    principalTable: "Branches",
                    principalColumn: "Id");

                migrationBuilder.AddForeignKey(
                    name: "FK_Customers_Routes_RouteId",
                    table: "Customers",
                    column: "RouteId",
                    principalTable: "Routes",
                    principalColumn: "Id");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Branches_Users_ManagerId",
                table: "Branches");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_Branches_BranchId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_Routes_RouteId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_BranchId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_RouteId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Branches_ManagerId",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Routes");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "RouteId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "ManagerUserId",
                table: "Branches");
        }
    }
}
