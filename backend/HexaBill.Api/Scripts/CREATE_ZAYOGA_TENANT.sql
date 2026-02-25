-- ============================================================================
-- ZAYOGA GENERAL TRADING - TENANT CREATION SCRIPT
-- ============================================================================
-- PURPOSE: Create first enterprise client with official VAT certificate details
-- DATABASE: PostgreSQL (Render / Production)
--
-- ⚠️ CRITICAL: Run only ONCE. Verify no duplicate tenant/email before execution.
-- ⚠️ SECURITY: Owner password = 'Zayoga@2026' — CLIENT MUST CHANGE ON FIRST LOGIN
--
-- USAGE: psql -h <host> -U <user> -d <database> -f CREATE_ZAYOGA_TENANT.sql
-- Or: Connect to Render Postgres, then \i path/to/CREATE_ZAYOGA_TENANT.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_tenant_id  INT;
    v_owner_id   INT;
    v_plan_id    INT;
BEGIN
    -- Check for duplicate (abort if exists)
    IF EXISTS (SELECT 1 FROM "Tenants" WHERE "Email" = 'info@zayoga.ae') THEN
        RAISE EXCEPTION 'Tenant with email info@zayoga.ae already exists. Aborting.';
    END IF;

    -- ----------------------------------------------------------------------------
    -- 1. INSERT TENANT (Company)
    -- ----------------------------------------------------------------------------
    INSERT INTO "Tenants" (
        "Name", "CompanyNameEn", "CompanyNameAr", "Country", "Currency",
        "VatNumber", "Address", "Phone", "Email", "Status",
        "CreatedAt", "TrialEndDate", "Subdomain", "Domain"
    ) VALUES (
        'ZAYOGA GENERAL TRADING',
        'ZAYOGA GENERAL TRADING - SOLE PROPRIETORSHIP L.L.C',
        'زايوغا للتجارة العامة - شركة الشخص الواحد ذ م م',
        'AE', 'AED',
        '104105871800003',
        'C13, Al Sawari, Tower-B Building, Al Khalidiyah, Abu Dhabi, 6727, Abu Dhabi',
        '+971 525697872',
        'info@zayoga.ae',
        'Active',
        NOW(),
        NULL,
        'zayoga',
        'www.zayoga.ae'
    )
    RETURNING "Id" INTO v_tenant_id;

    RAISE NOTICE '1. Tenant created: Id = %', v_tenant_id;

    -- ----------------------------------------------------------------------------
    -- 2. INSERT OWNER USER
    -- Password: Zayoga@2026 (CLIENT MUST CHANGE ON FIRST LOGIN)
    -- ----------------------------------------------------------------------------
    INSERT INTO "Users" (
        "Name", "Email", "PasswordHash", "Role", "Phone",
        "TenantId", "OwnerId", "CreatedAt", "SessionVersion"
    ) VALUES (
        'Admin',
        'info@zayoga.ae',
        crypt('Zayoga@2026', gen_salt('bf', 10)),
        'Owner',
        '+971 525697872',
        v_tenant_id,
        v_tenant_id,
        NOW(),
        1
    )
    RETURNING "Id" INTO v_owner_id;

    RAISE NOTICE '2. Owner user created: Id = %', v_owner_id;

    -- ----------------------------------------------------------------------------
    -- 3. SUBSCRIPTION (get first active plan)
    -- ----------------------------------------------------------------------------
    SELECT "Id" INTO v_plan_id
    FROM "SubscriptionPlans"
    WHERE "IsActive" = true
    ORDER BY "DisplayOrder", "MonthlyPrice"
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        INSERT INTO "SubscriptionPlans" (
            "Name", "Description", "MonthlyPrice", "YearlyPrice", "Currency",
            "MaxUsers", "MaxProducts", "MaxCustomers", "MaxInvoicesPerMonth",
            "MaxStorageMB", "TrialDays", "IsActive", "DisplayOrder", "CreatedAt"
        ) VALUES (
            'Basic', 'Basic plan', 99, 990, 'AED',
            10, 5000, 2000, 5000,
            2048, 0, true, 1, NOW()
        );
        v_plan_id := currval(pg_get_serial_sequence('"SubscriptionPlans"', 'Id'));
    END IF;

    INSERT INTO "Subscriptions" (
        "TenantId", "PlanId", "Status", "BillingCycle",
        "StartDate", "Amount", "Currency", "CreatedAt"
    ) VALUES (
        v_tenant_id,
        v_plan_id,
        1,      -- Active
        0,      -- Monthly
        NOW(),
        (SELECT "MonthlyPrice" FROM "SubscriptionPlans" WHERE "Id" = v_plan_id),
        'AED',
        NOW()
    );

    RAISE NOTICE '3. Subscription created';

    -- ----------------------------------------------------------------------------
    -- 4. COMPANY SETTINGS (for invoices, VAT, Arabic header)
    -- ----------------------------------------------------------------------------
    INSERT INTO "Settings" ("Key", "OwnerId", "TenantId", "Value", "CreatedAt", "UpdatedAt") VALUES
    ('COMPANY_NAME_EN',  v_tenant_id, v_tenant_id, 'ZAYOGA GENERAL TRADING - SOLE PROPRIETORSHIP L.L.C', NOW(), NOW()),
    ('COMPANY_NAME_AR',  v_tenant_id, v_tenant_id, 'زايوغا للتجارة العامة - شركة الشخص الواحد ذ م م', NOW(), NOW()),
    ('COMPANY_TRN',      v_tenant_id, v_tenant_id, '104105871800003', NOW(), NOW()),
    ('COMPANY_ADDRESS',  v_tenant_id, v_tenant_id, 'C13, Al Sawari, Tower-B Building, Al Khalidiyah, Abu Dhabi, 6727, Abu Dhabi', NOW(), NOW()),
    ('COMPANY_PHONE',    v_tenant_id, v_tenant_id, '+971 525697872', NOW(), NOW()),
    ('COMPANY_EMAIL',    v_tenant_id, v_tenant_id, 'info@zayoga.ae', NOW(), NOW()),
    ('COMPANY_WEBSITE',  v_tenant_id, v_tenant_id, 'www.zayoga.ae', NOW(), NOW()),
    ('COMPANY_LANDLINE', v_tenant_id, v_tenant_id, '+971 2 245 0340', NOW(), NOW()),
    ('LICENSE_NUMBER',   v_tenant_id, v_tenant_id, '4937175CN', NOW(), NOW()),
    ('LICENSE_AUTHORITY', v_tenant_id, v_tenant_id, 'Abu Dhabi Department of Economic Development', NOW(), NOW()),
    ('VAT_EFFECTIVE_DATE', v_tenant_id, v_tenant_id, '01-08-2023', NOW(), NOW()),
    ('VAT_LEGAL_TEXT',   v_tenant_id, v_tenant_id, 'VAT registered under Federal Decree-Law No. 8 of 2017, UAE', NOW(), NOW()),
    ('VAT_PERCENT',      v_tenant_id, v_tenant_id, '5', NOW(), NOW()),
    ('CURRENCY',         v_tenant_id, v_tenant_id, 'AED', NOW(), NOW()),
    ('INVOICE_PREFIX',   v_tenant_id, v_tenant_id, 'ZG', NOW(), NOW()),
    ('VAT_FILING_PERIOD', v_tenant_id, v_tenant_id, 'Quarterly', NOW(), NOW());

    RAISE NOTICE '4. Company settings inserted';

    RAISE NOTICE '=== ZAYOGA TENANT CREATED SUCCESSFULLY ===';
    RAISE NOTICE 'TenantId: % | OwnerUserId: %', v_tenant_id, v_owner_id;
    RAISE NOTICE 'Login: info@zayoga.ae | Password: Zayoga@2026';
    RAISE NOTICE 'CLIENT MUST CHANGE PASSWORD ON FIRST LOGIN';
END $$;

-- ============================================================================
-- VERIFICATION (run after script)
-- ============================================================================
-- SELECT "Id", "Name", "Email", "VatNumber", "Status" FROM "Tenants" WHERE "Email" = 'info@zayoga.ae';
-- SELECT "Id", "Name", "Email", "Role", "TenantId" FROM "Users" WHERE "Email" = 'info@zayoga.ae';
-- SELECT "Key", "Value" FROM "Settings" WHERE "OwnerId" = (SELECT "Id" FROM "Tenants" WHERE "Email" = 'info@zayoga.ae');
-- ============================================================================
