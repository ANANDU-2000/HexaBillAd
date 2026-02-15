# 🏢 TENANT MODEL DOCUMENTATION

**Purpose:** Define Tenant entity structure and migration strategy  
**Last Updated:** Phase 1 - February 2026  
**Status:** ACTIVE

---

## TENANT ENTITY STRUCTURE

### Core Properties

```csharp
public class Tenant
{
    public int Id { get; set; }                    // Primary key
    public string Name { get; set; }               // Tenant display name
    public string? Subdomain { get; set; }        // For future: tenant1.app.com
    public string? Domain { get; set; }           // For future: tenant1.com
    public string Country { get; set; }           // Default: "AE"
    public string Currency { get; set; }          // Default: "AED"
    public string? VatNumber { get; set; }        // VAT registration number
    public string? CompanyNameEn { get; set; }    // English company name
    public string? CompanyNameAr { get; set; }    // Arabic company name
    public string? Address { get; set; }          // Company address
    public string? Phone { get; set; }            // Contact phone
    public string? Email { get; set; }            // Contact email
    public string? LogoPath { get; set; }        // Path to logo file
    public TenantStatus Status { get; set; }      // Current status
    public DateTime CreatedAt { get; set; }       // Creation timestamp
    public DateTime? TrialEndDate { get; set; }  // Trial expiration
    public DateTime? SuspendedAt { get; set; }    // Suspension timestamp
    public string? SuspensionReason { get; set; } // Why suspended
}
```

### Tenant Status Enum

```csharp
public enum TenantStatus
{
    Active = 0,      // Fully operational
    Suspended = 1,   // Temporarily disabled
    Trial = 2,       // In trial period
    Expired = 3      // Trial expired, needs payment
}
```

---

## TENANT LIFECYCLE

### Status Transitions

```
Created → Trial → Active
         ↓
      Expired
         ↓
      Suspended
```

### Status Rules

1. **Active:** Full access, all features enabled
2. **Trial:** Full access, expires after `TrialEndDate`
3. **Expired:** Read-only access, cannot create new data
4. **Suspended:** No access, blocked by middleware

---

## TENANTID VS OWNERID MIGRATION

### Current State (Before Migration)

- **OwnerId** exists in all business tables
- **OwnerId** values: 1, 2 (hardcoded)
- **OwnerId** used for data filtering

### Target State (After Migration)

- **TenantId** exists in all business tables
- **TenantId** values: Any integer (unlimited tenants)
- **TenantId** used for data filtering
- **OwnerId** removed (after migration complete)

### Migration Steps

1. **Create Tenant table** - Add entity, migration
2. **Add TenantId columns** - Add to all business tables (nullable initially)
3. **Migrate data** - Copy OwnerId → TenantId
4. **Update code** - Replace OwnerId references with TenantId
5. **Test thoroughly** - Verify tenant isolation
6. **Remove OwnerId** - Final cleanup (only after all tests pass)

---

## TENANT DATA MODELING

### Tenant-Scoped Tables

**ALL of these tables MUST have TenantId:**

- Sales
- Customers
- Products
- Purchases
- Payments
- Expenses
- InventoryTransactions
- Alerts (system alerts use TenantId = 0)
- InvoiceTemplates
- InvoiceVersions
- SaleReturns
- PurchaseReturns
- PriceChangeLogs
- AuditLogs
- Settings (composite key: Key + TenantId)

### Non-Tenant Tables

**These tables do NOT have TenantId:**

- Tenants (obviously)
- Users (has TenantId, but SystemAdmin has TenantId = null)
- SystemLogs (has TenantId, but nullable for system logs)

---

## TENANT CREATION

### Manual Creation (Phase 1)

**API Endpoint:** `POST /api/tenants` (SystemAdmin only)

**Request:**
```json
{
  "name": "New Tenant",
  "country": "AE",
  "currency": "AED",
  "vatNumber": "123456789",
  "companyNameEn": "Company Name",
  "address": "Address",
  "phone": "+971 12 345 6789",
  "email": "contact@company.com"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "New Tenant",
  "status": "Trial",
  "trialEndDate": "2026-03-11T00:00:00Z",
  "createdAt": "2026-02-11T00:00:00Z"
}
```

### Automatic Creation (Phase 2)

- Public signup flow
- Email verification
- Trial period assignment
- Payment gateway integration

---

## TENANT SETTINGS

### Settings Table Structure

**Composite Key:** `(Key, TenantId)`

**Common Settings:**
- `VAT_PERCENT` - VAT percentage
- `COMPANY_NAME_EN` - English company name
- `COMPANY_NAME_AR` - Arabic company name
- `COMPANY_ADDRESS` - Company address
- `COMPANY_TRN` - Tax registration number
- `COMPANY_PHONE` - Contact phone
- `CURRENCY` - Currency code
- `INVOICE_PREFIX` - Invoice number prefix
- `VAT_EFFECTIVE_DATE` - VAT effective date
- `VAT_LEGAL_TEXT` - VAT legal text

**Settings are tenant-specific** - Each tenant has their own settings.

---

## TENANT ISOLATION

### Database Level

**PostgreSQL Row-Level Security (RLS):**

```sql
CREATE POLICY tenant_isolation_sales ON "Sales"
    USING (TenantId = current_setting('app.tenant_id')::int 
           OR current_setting('app.tenant_id')::int = 0);
```

**SystemAdmin (tenant_id = 0) can see all rows.**

### Application Level

**TenantContextMiddleware:**
- Extracts `tenant_id` from JWT
- Validates tenant exists
- Checks tenant status
- Sets `HttpContext.Items["TenantId"]`
- Sets PostgreSQL session variable

**All queries MUST filter by TenantId:**

```csharp
var sales = await _context.Sales
    .Where(s => s.TenantId == tenantId)
    .ToListAsync();
```

---

## TENANT USAGE TRACKING

### TenantUsage Table

**Tracks per-tenant metrics:**

```csharp
public class TenantUsage
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int InvoiceCount { get; set; }      // Total invoices
    public int ActiveUsers { get; set; }       // Active user count
    public decimal StorageMB { get; set; }     // Storage usage
    public DateTime LastUpdated { get; set; }  // Last update timestamp
}
```

**Updated daily via background job.**

**Used by SuperAdmin dashboard for tenant management.**

---

## TENANT BRANDING

### Tenant-Specific Branding

**Each tenant can have:**
- Company name (English/Arabic)
- Logo
- Address
- Contact information
- VAT number
- Invoice template customization

**Used in:**
- Invoice PDFs
- Email templates
- UI branding (Phase 2)

---

## SYSTEM ADMIN VS TENANT ADMIN

### SystemAdmin (TenantId = null or 0)

- Not linked to any tenant
- Can view all tenants
- Manages platform settings
- Cannot access tenant business data directly
- Can impersonate tenants (Phase 2)

### TenantAdmin (TenantId = specific tenant)

- Linked to specific tenant
- Full control within tenant
- Cannot see other tenants
- Manages tenant users and settings

---

## MIGRATION SAFETY

### Rollback Plan

**If migration fails:**
1. Keep OwnerId column intact
2. Revert code changes
3. Remove TenantId columns
4. Restore from backup

**DO NOT remove OwnerId until:**
- ✅ All tests passing
- ✅ Tenant isolation verified
- ✅ Production data migrated successfully
- ✅ No OwnerId references in code (except migrations)

---

## FUTURE ENHANCEMENTS (Phase 2+)

### Planned Features

- Subdomain support (`tenant1.app.com`)
- Custom domain support (`tenant1.com`)
- Tenant signup flow
- Subscription management
- Payment gateway integration
- Tenant analytics dashboard
- Tenant-level feature flags
- Tenant-level backups

---

## VALIDATION RULES

### Tenant Creation Validation

- Name required, max 200 characters
- Country required, valid country code
- Currency required, valid currency code
- Email format validation (if provided)
- Phone format validation (if provided)
- VAT number format validation (if provided)

### Tenant Update Validation

- Cannot change TenantId (immutable)
- Status transitions validated
- Suspension reason required when suspending

---

## TESTING REQUIREMENTS

### Must Test

- Tenant creation
- Tenant status transitions
- Tenant isolation (Tenant A cannot access Tenant B)
- SystemAdmin can see all tenants
- Suspended tenant blocked
- Expired trial blocked
- Tenant settings isolation

---

**Last Updated:** Phase 1 Start  
**Next Review:** Phase 1 Complete
