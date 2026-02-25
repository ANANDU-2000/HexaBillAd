using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <summary>
    /// Fixes 500 on PostgreSQL: 11 tables were created with Sqlite:Autoincrement (ignored on Npgsql).
    /// Adds sequence defaults so INSERT without Id succeeds: BranchStaff, RouteStaff, RouteCustomer,
    /// RouteExpense, CustomerVisit, UserSessions, RecurringExpenses, DamageCategories, ProductCategories,
    /// HeldInvoices, FailedLoginAttempts.
    /// </summary>
    public partial class FixBranchStaffRouteStaffIdIdentity : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL")
                return;

            // BranchStaff.Id: use sequence so EF can omit Id on INSERT
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'BranchStaff_Id_seq') THEN
                        CREATE SEQUENCE ""BranchStaff_Id_seq"";
                        ALTER TABLE ""BranchStaff"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""BranchStaff_Id_seq""');
                        PERFORM setval('""BranchStaff_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""BranchStaff""), 1));
                    END IF;
                END $$;
            ");

            // RouteStaff.Id: same
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'RouteStaff_Id_seq') THEN
                        CREATE SEQUENCE ""RouteStaff_Id_seq"";
                        ALTER TABLE ""RouteStaff"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""RouteStaff_Id_seq""');
                        PERFORM setval('""RouteStaff_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""RouteStaff""), 1));
                    END IF;
                END $$;
            ");

            // RouteCustomer.Id: Add without Id in CustomerService, RouteService
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'RouteCustomers_Id_seq') THEN
                        CREATE SEQUENCE ""RouteCustomers_Id_seq"";
                        ALTER TABLE ""RouteCustomers"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""RouteCustomers_Id_seq""');
                        PERFORM setval('""RouteCustomers_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""RouteCustomers""), 1));
                    END IF;
                END $$;
            ");

            // RouteExpense.Id: Add without Id in RouteService
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'RouteExpenses_Id_seq') THEN
                        CREATE SEQUENCE ""RouteExpenses_Id_seq"";
                        ALTER TABLE ""RouteExpenses"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""RouteExpenses_Id_seq""');
                        PERFORM setval('""RouteExpenses_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""RouteExpenses""), 1));
                    END IF;
                END $$;
            ");

            // CustomerVisit.Id: Add without Id in RouteService, CustomerVisitsController
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'CustomerVisits_Id_seq') THEN
                        CREATE SEQUENCE ""CustomerVisits_Id_seq"";
                        ALTER TABLE ""CustomerVisits"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""CustomerVisits_Id_seq""');
                        PERFORM setval('""CustomerVisits_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""CustomerVisits""), 1));
                    END IF;
                END $$;
            ");

            // UserSessions.Id: Add without Id in AuthService (every login)
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'UserSessions_Id_seq') THEN
                        CREATE SEQUENCE ""UserSessions_Id_seq"";
                        ALTER TABLE ""UserSessions"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""UserSessions_Id_seq""');
                        PERFORM setval('""UserSessions_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""UserSessions""), 1));
                    END IF;
                END $$;
            ");

            // RecurringExpenses.Id: Add without Id in ExpensesController
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'RecurringExpenses_Id_seq') THEN
                        CREATE SEQUENCE ""RecurringExpenses_Id_seq"";
                        ALTER TABLE ""RecurringExpenses"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""RecurringExpenses_Id_seq""');
                        PERFORM setval('""RecurringExpenses_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""RecurringExpenses""), 1));
                    END IF;
                END $$;
            ");

            // DamageCategories.Id: Add without Id in Program.cs seed
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'DamageCategories_Id_seq') THEN
                        CREATE SEQUENCE ""DamageCategories_Id_seq"";
                        ALTER TABLE ""DamageCategories"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""DamageCategories_Id_seq""');
                        PERFORM setval('""DamageCategories_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""DamageCategories""), 1));
                    END IF;
                END $$;
            ");

            // ProductCategories.Id: Add without Id in ProductCategoriesController
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'ProductCategories_Id_seq') THEN
                        CREATE SEQUENCE ""ProductCategories_Id_seq"";
                        ALTER TABLE ""ProductCategories"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""ProductCategories_Id_seq""');
                        PERFORM setval('""ProductCategories_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""ProductCategories""), 1));
                    END IF;
                END $$;
            ");

            // HeldInvoices.Id: Add without Id in SalesController
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'HeldInvoices_Id_seq') THEN
                        CREATE SEQUENCE ""HeldInvoices_Id_seq"";
                        ALTER TABLE ""HeldInvoices"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""HeldInvoices_Id_seq""');
                        PERFORM setval('""HeldInvoices_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""HeldInvoices""), 1));
                    END IF;
                END $$;
            ");

            // FailedLoginAttempts.Id: Add without Id in LoginLockoutService
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'FailedLoginAttempts_Id_seq') THEN
                        CREATE SEQUENCE ""FailedLoginAttempts_Id_seq"";
                        ALTER TABLE ""FailedLoginAttempts"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""FailedLoginAttempts_Id_seq""');
                        PERFORM setval('""FailedLoginAttempts_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""FailedLoginAttempts""), 1));
                    END IF;
                END $$;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL")
                return;

            migrationBuilder.Sql(@"ALTER TABLE ""BranchStaff"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""BranchStaff_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""RouteStaff"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""RouteStaff_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""RouteCustomers"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""RouteCustomers_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""RouteExpenses"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""RouteExpenses_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""CustomerVisits"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""CustomerVisits_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""UserSessions"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""UserSessions_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""RecurringExpenses"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""RecurringExpenses_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""DamageCategories"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""DamageCategories_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""ProductCategories"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""ProductCategories_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""HeldInvoices"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""HeldInvoices_Id_seq"";");
            migrationBuilder.Sql(@"ALTER TABLE ""FailedLoginAttempts"" ALTER COLUMN ""Id"" DROP DEFAULT; DROP SEQUENCE IF EXISTS ""FailedLoginAttempts_Id_seq"";");
        }
    }
}
