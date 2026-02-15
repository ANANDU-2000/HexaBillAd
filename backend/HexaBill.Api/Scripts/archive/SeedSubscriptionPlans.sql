-- ============================================
-- SEED DEFAULT SUBSCRIPTION PLANS
-- Purpose: Create default subscription plans for SaaS
-- Date: 2026-02-11
-- ============================================

-- Insert default subscription plans if they don't exist
INSERT INTO "SubscriptionPlans" ("Name", "Description", "MonthlyPrice", "YearlyPrice", "Currency", "MaxUsers", "MaxInvoicesPerMonth", "MaxCustomers", "MaxProducts", "MaxStorageMB", "HasAdvancedReports", "HasApiAccess", "HasWhiteLabel", "HasPrioritySupport", "HasCustomBranding", "TrialDays", "IsActive", "DisplayOrder", "CreatedAt")
VALUES
    (
        'Basic',
        'Perfect for small businesses getting started',
        99.00,
        990.00,
        'AED',
        5,
        100,
        500,
        1000,
        1024,
        false,
        false,
        false,
        false,
        false,
        14,
        true,
        1,
        NOW()
    ),
    (
        'Professional',
        'For growing businesses with advanced needs',
        199.00,
        1990.00,
        'AED',
        15,
        500,
        2000,
        5000,
        5120,
        true,
        true,
        false,
        true,
        true,
        14,
        true,
        2,
        NOW()
    ),
    (
        'Enterprise',
        'For large businesses with unlimited needs',
        499.00,
        4990.00,
        'AED',
        -1, -- Unlimited
        -1, -- Unlimited
        -1, -- Unlimited
        -1, -- Unlimited
        -1, -- Unlimited
        true,
        true,
        true,
        true,
        true,
        14,
        true,
        3,
        NOW()
    )
ON CONFLICT DO NOTHING;

-- Verify plans were created
SELECT "Id", "Name", "MonthlyPrice", "MaxUsers", "IsActive" FROM "SubscriptionPlans" ORDER BY "DisplayOrder";
