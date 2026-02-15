# 🏗️ ARCHITECTURE LOCK DOCUMENT

**Purpose:** Lock architectural decisions to prevent deviation during refactoring  
**Last Updated:** Phase 1 - February 2026  
**Status:** ACTIVE - DO NOT DEVIATE

---

## MODULE STRUCTURE RULES

### Rule 1: Module Organization

Each module MUST follow this structure:

```
ModuleName/
├── ModuleNameController.cs      # API endpoints only
├── IModuleNameService.cs         # Service interface
├── ModuleNameService.cs          # Business logic implementation
├── ModuleNameRepository.cs       # Data access (if needed)
├── ModuleNameValidators.cs       # Input validation
└── ModuleNameMappings.cs         # Entity ↔ DTO mappings
```

### Rule 2: No Cross-Module Direct Access

**FORBIDDEN:**
```csharp
// ❌ DO NOT DO THIS
public class SaleService
{
    private readonly AppDbContext _context;
    public async Task CreateSale()
    {
        var customer = await _context.Customers.FindAsync(id); // Direct DB access
    }
}
```

**REQUIRED:**
```csharp
// ✅ DO THIS INSTEAD
public class SaleService
{
    private readonly ICustomerService _customerService; // Use service interface
    public async Task CreateSale()
    {
        var customer = await _customerService.GetCustomerAsync(id);
    }
}
```

### Rule 3: Service Interface Pattern

**ALL services MUST have interfaces:**

```csharp
// ✅ CORRECT
public interface ISaleService
{
    Task<SaleDto> CreateSaleAsync(CreateSaleRequest request);
}

public class SaleService : ISaleService
{
    // Implementation
}
```

**Registration in Program.cs:**
```csharp
builder.Services.AddScoped<ISaleService, SaleService>();
```

### Rule 4: Repository Pattern (Optional)

Use repository pattern ONLY if:
- Complex queries need abstraction
- Multiple data sources
- Caching layer needed

Otherwise, use `AppDbContext` directly in services.

---

## CONTROLLER RULES

### Rule 5: Controllers Are Thin

**Controllers MUST:**
- Extract TenantId from context
- Call service methods
- Return HTTP responses
- Handle exceptions (via middleware)

**Controllers MUST NOT:**
- Contain business logic
- Access database directly
- Perform validation (use validators)
- Transform data (use mappings)

**Example:**
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController : ControllerBase
{
    private readonly ISaleService _saleService;
    private readonly ITenantContextService _tenantContext;

    [HttpPost]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleRequest request)
    {
        var tenantId = _tenantContext.GetCurrentTenantId() ?? throw new UnauthorizedException();
        var result = await _saleService.CreateSaleAsync(request, tenantId);
        return Ok(result);
    }
}
```

---

## DATA ACCESS RULES

### Rule 6: TenantId Filtering

**ALL queries MUST filter by TenantId:**

```csharp
// ✅ CORRECT
var sales = await _context.Sales
    .Where(s => s.TenantId == tenantId)
    .ToListAsync();
```

**Exception:** SystemAdmin (tenantId = null or 0) can see all data.

### Rule 7: Never Trust Frontend TenantId

**FORBIDDEN:**
```csharp
// ❌ NEVER DO THIS
public async Task GetSale(int id, int tenantId) // tenantId from request
{
    var sale = await _context.Sales.FindAsync(id);
}
```

**REQUIRED:**
```csharp
// ✅ ALWAYS DO THIS
public async Task GetSale(int id, int tenantId) // tenantId from JWT/context
{
    var sale = await _context.Sales
        .Where(s => s.Id == id && s.TenantId == tenantId)
        .FirstOrDefaultAsync();
}
```

---

## SECURITY RULES

### Rule 8: TenantId Always from Context

**TenantId MUST come from:**
- JWT token (`tenant_id` claim)
- `TenantContextMiddleware` (sets `HttpContext.Items["TenantId"]`)
- `ITenantContextService.GetCurrentTenantId()`

**TenantId MUST NEVER come from:**
- Request body
- Query parameters
- Route parameters
- User input

### Rule 9: Authorization Checks

**Always check authorization:**
```csharp
[Authorize(Roles = "TenantOwner,TenantAdmin")]
public async Task DeleteSale(int id)
{
    // Implementation
}
```

**For SystemAdmin:**
```csharp
if (_tenantContext.IsSystemAdmin())
{
    // System admin logic
}
```

---

## ERROR HANDLING RULES

### Rule 10: Exception Types

**Use custom exceptions:**
- `TenantNotFoundException` - Tenant doesn't exist
- `TenantSuspendedException` - Tenant is suspended
- `UnauthorizedTenantAccessException` - Cross-tenant access attempt
- `ValidationException` - Input validation failed

**DO NOT use generic `Exception`.**

### Rule 11: Error Logging

**All errors MUST be logged with:**
- TenantId
- UserId
- Endpoint
- Exception details

**Use `SystemLog` table for persistence.**

---

## VALIDATION RULES

### Rule 12: Validation Location

**Validation MUST happen:**
- In `*Validators.cs` files
- Before service methods
- Using `ValidationResult` pattern

**Example:**
```csharp
public static class SaleValidators
{
    public static ValidationResult ValidateCreateSale(CreateSaleRequest request, int tenantId)
    {
        var errors = new List<string>();
        
        if (request.CustomerId == null)
            errors.Add("Customer is required");
        
        // More validations...
        
        return new ValidationResult 
        { 
            IsValid = errors.Count == 0, 
            Errors = errors 
        };
    }
}
```

---

## MAPPING RULES

### Rule 13: Entity ↔ DTO Mapping

**Use mapping classes:**

```csharp
public static class SaleMappings
{
    public static SaleDto ToDto(this Sale sale)
    {
        return new SaleDto
        {
            Id = sale.Id,
            InvoiceNo = sale.InvoiceNo,
            // Map all properties
        };
    }
    
    public static Sale ToEntity(this CreateSaleRequest request, int tenantId)
    {
        return new Sale
        {
            TenantId = tenantId,
            InvoiceNo = request.InvoiceNo,
            // Map all properties
        };
    }
}
```

**DO NOT map in controllers or services directly.**

---

## TESTING RULES

### Rule 14: Test Coverage

**MUST test:**
- Tenant isolation (Tenant A cannot access Tenant B data)
- Role-based authorization
- Validation rules
- Business logic

**Test structure:**
```
Tests/
├── TenantIsolationTests.cs
├── AuthorizationTests.cs
├── ValidationTests.cs
└── BusinessLogicTests.cs
```

---

## MIGRATION RULES

### Rule 15: OwnerId → TenantId Migration

**During migration:**
1. Keep OwnerId column until migration complete
2. Add TenantId column
3. Copy data: `TenantId = OwnerId`
4. Update all code to use TenantId
5. Test thoroughly
6. Remove OwnerId column (final step)

**DO NOT remove OwnerId until ALL tests pass.**

---

## FOLDER STRUCTURE RULES

### Rule 16: Module Location

**All modules MUST be in:**
```
backend/HexaBill.Api/Modules/{ModuleName}/
```

**Shared code MUST be in:**
```
backend/HexaBill.Api/Shared/{Category}/
```

**DO NOT create modules outside `Modules/` folder.**

---

## DEPENDENCY RULES

### Rule 17: Dependency Direction

**Dependencies MUST flow:**
```
Controllers → Services → Repositories → DbContext
```

**DO NOT create circular dependencies.**

**DO NOT have services depend on controllers.**

---

## NAMING CONVENTIONS

### Rule 18: Naming Standards

- **Controllers:** `{Entity}Controller.cs`
- **Services:** `{Entity}Service.cs` (implements `I{Entity}Service`)
- **Repositories:** `{Entity}Repository.cs` (implements `I{Entity}Repository`)
- **Validators:** `{Entity}Validators.cs` (static class)
- **Mappings:** `{Entity}Mappings.cs` (static class)
- **DTOs:** `{Entity}Dto.cs`, `Create{Entity}Request.cs`, `Update{Entity}Request.cs`

---

## PERFORMANCE RULES

### Rule 19: Query Optimization

**ALWAYS:**
- Use `AsNoTracking()` for read-only queries
- Add indexes on `TenantId` columns
- Use pagination for lists
- Limit page size (max 100 items)

**Example:**
```csharp
var sales = await _context.Sales
    .AsNoTracking()
    .Where(s => s.TenantId == tenantId)
    .OrderByDescending(s => s.CreatedAt)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

---

## DOCUMENTATION RULES

### Rule 20: Code Documentation

**MUST document:**
- Public service methods
- Complex business logic
- Security-sensitive code
- Tenant isolation logic

**Use XML comments:**
```csharp
/// <summary>
/// Creates a new sale for the current tenant.
/// Validates tenant access and business rules.
/// </summary>
/// <param name="request">Sale creation request</param>
/// <param name="tenantId">Tenant ID from context (never from request)</param>
/// <returns>Created sale DTO</returns>
public async Task<SaleDto> CreateSaleAsync(CreateSaleRequest request, int tenantId)
{
    // Implementation
}
```

---

## LOCK STATUS

**This document is LOCKED during Phase 1.**

**DO NOT deviate from these rules without explicit approval.**

**If you find a rule that needs modification, document the exception and get approval before proceeding.**

---

**Last Reviewed:** Phase 1 Start  
**Next Review:** Phase 1 Complete
