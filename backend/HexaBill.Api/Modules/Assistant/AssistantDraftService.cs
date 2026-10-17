using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Expenses;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>The fields of a proposed new customer, after trimming. Property order is part of the hash, do not reorder.</summary>
public sealed record CustomerDraftFields(
    string Name, string? Phone, string? Email, string? Trn, string? Address, decimal CreditLimit, string? PaymentTerms, string CustomerType);

/// <summary>What the person typed. Deliberately has no validation attributes: problems come back per field, not as a bare 400.</summary>
public sealed class CustomerDraftRequest
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Trn { get; set; }
    public string? Address { get; set; }
    public decimal CreditLimit { get; set; }
    public string? PaymentTerms { get; set; }
    public string? CustomerType { get; set; }
}

/// <summary>A proposed plain expense (no VAT options). Property order is part of the hash, do not reorder.</summary>
public sealed record ExpenseDraftFields(int CategoryId, string CategoryName, decimal Amount, string Date, string? Note);

public sealed class ExpenseDraftRequest
{
    public int CategoryId { get; set; }
    public decimal Amount { get; set; }
    /// <summary>yyyy-MM-dd</summary>
    public string? Date { get; set; }
    public string? Note { get; set; }
}

public sealed record DraftFieldError(string Field, string Message);

public sealed record DraftView(
    Guid Id, string Kind, string Status, object Fields, IReadOnlyList<DraftFieldError> Errors,
    IReadOnlyList<string> Warnings, string PayloadHash, DateTime ExpiresAt, object? Result);

public sealed class DraftException : Exception
{
    public int StatusCode { get; }
    public DraftException(int statusCode, string message) : base(message) => StatusCode = statusCode;
}

/// <summary>
/// Server-held drafts. Create stores a proposal and changes nothing in the books. Confirm re-checks the caller, the expiry
/// and the content hash, claims the draft so it can only run once, and then calls the existing domain service for the kind
/// (customers or expenses), with the same scope the normal screens use.
/// </summary>
public sealed class AssistantDraftService
{
    public const string CustomerCreate = "customer.create";
    public const string ExpenseCreate = "expense.create";
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    private const int MaxOpenDraftsPerUser = 20;

    private readonly AppDbContext _context;
    private readonly ICustomerService _customers;
    private readonly IExpenseService _expenses;
    private readonly IRouteScopeService _routeScope;

    public AssistantDraftService(AppDbContext context, ICustomerService customers, IExpenseService expenses, IRouteScopeService routeScope)
    {
        _context = context;
        _customers = customers;
        _expenses = expenses;
        _routeScope = routeScope;
    }

    public static string Hash<T>(T fields)
    {
        var json = JsonSerializer.Serialize(fields);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
    }

    // ---------------------------------------------------------------- customers

    public static CustomerDraftFields Normalise(CustomerDraftRequest raw)
    {
        static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        var type = string.Equals(raw.CustomerType?.Trim(), "Cash", StringComparison.OrdinalIgnoreCase) ? "Cash" : "Credit";
        return new CustomerDraftFields(raw.Name?.Trim() ?? string.Empty, Clean(raw.Phone), Clean(raw.Email), Clean(raw.Trn),
            Clean(raw.Address), Math.Round(raw.CreditLimit, 2, MidpointRounding.AwayFromZero), Clean(raw.PaymentTerms), type);
    }

    public static List<DraftFieldError> Validate(CustomerDraftFields f)
    {
        var errors = new List<DraftFieldError>();
        if (f.Name.Length == 0) errors.Add(new("name", "Enter the customer name."));
        else if (f.Name.Length > 200) errors.Add(new("name", "The name can be at most 200 characters."));
        if (f.Phone is { Length: > 20 }) errors.Add(new("phone", "The phone number can be at most 20 characters."));
        if (f.Email != null)
        {
            if (f.Email.Length > 100) errors.Add(new("email", "The email can be at most 100 characters."));
            else if (!f.Email.Contains('@') || f.Email.StartsWith('@') || f.Email.EndsWith('@') || f.Email.Contains(' '))
                errors.Add(new("email", "Enter a valid email address, or leave it empty."));
        }
        if (f.Trn is { Length: > 50 }) errors.Add(new("trn", "The TRN can be at most 50 characters."));
        if (f.Address is { Length: > 500 }) errors.Add(new("address", "The address can be at most 500 characters."));
        if (f.PaymentTerms is { Length: > 100 }) errors.Add(new("paymentTerms", "The payment terms can be at most 100 characters."));
        if (f.CreditLimit < 0 || f.CreditLimit > 99999999.99m) errors.Add(new("creditLimit", "The credit limit must be between 0 and 99,999,999.99."));
        return errors;
    }

    public async Task<DraftView> CreateCustomerDraftAsync(int tenantId, int userId, CustomerDraftRequest raw, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await EnsureUnderLimitAsync(tenantId, userId, now, ct);

        var fields = Normalise(raw);
        var errors = Validate(fields);
        var warnings = new List<string>();
        if (fields.Name.Length > 0)
        {
            var lowered = fields.Name.ToLower();
            var duplicate = await _context.Customers.AnyAsync(c => c.TenantId == tenantId && c.Name.Trim().ToLower() == lowered, ct);
            if (duplicate) errors.Add(new("name", "A customer with this name already exists. Use a different name."));
        }
        if (fields.Phone == null && fields.Email == null) warnings.Add("No phone or email: you will not be able to contact this customer from the system.");

        // A draft with problems can never be confirmed, so it is shown but not stored. This keeps abandoned or
        // half-typed attempts from using up the open-draft limit.
        if (errors.Count > 0)
            return new DraftView(Guid.Empty, CustomerCreate, "Invalid", fields, errors, warnings, string.Empty, now, null);

        var draft = await StoreAsync(tenantId, userId, CustomerCreate, fields, now, ct);
        return ToView(draft, errors, warnings);
    }

    // ----------------------------------------------------------------- expenses

    private static readonly DateTime EarliestExpenseDate = new(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public static List<DraftFieldError> ValidateExpense(ExpenseDraftFields f, DateTime nowUtc)
    {
        var errors = new List<DraftFieldError>();
        if (f.CategoryId <= 0 || f.CategoryName.Length == 0) errors.Add(new("categoryId", "Choose an expense category."));
        if (f.Amount <= 0 || f.Amount > 99999999.99m) errors.Add(new("amount", "Enter an amount greater than 0 and at most 99,999,999.99."));
        if (!DateTime.TryParseExact(f.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            errors.Add(new("date", "Enter the date as year-month-day."));
        else if (date.Date > nowUtc.Date.AddDays(1)) errors.Add(new("date", "The date cannot be in the future."));
        else if (date.Date < EarliestExpenseDate) errors.Add(new("date", "That date is too far in the past."));
        if (f.Note is { Length: > 500 }) errors.Add(new("note", "The note can be at most 500 characters."));
        return errors;
    }

    public async Task<DraftView> CreateExpenseDraftAsync(int tenantId, int userId, ExpenseDraftRequest raw, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await EnsureUnderLimitAsync(tenantId, userId, now, ct);

        var categoryName = raw.CategoryId > 0
            ? await _context.ExpenseCategories.Where(c => c.Id == raw.CategoryId && c.TenantId == tenantId).Select(c => c.Name).FirstOrDefaultAsync(ct)
            : null;
        var note = string.IsNullOrWhiteSpace(raw.Note) ? null : raw.Note.Trim();
        var fields = new ExpenseDraftFields(raw.CategoryId, categoryName ?? string.Empty, Math.Round(raw.Amount, 2, MidpointRounding.AwayFromZero), raw.Date?.Trim() ?? string.Empty, note);
        var errors = ValidateExpense(fields, now);
        var warnings = new List<string> { "If this day is already closed, or its VAT period is locked, confirming will be refused and nothing is saved." };

        if (errors.Count > 0)
            return new DraftView(Guid.Empty, ExpenseCreate, "Invalid", fields, errors, warnings, string.Empty, now, null);

        var draft = await StoreAsync(tenantId, userId, ExpenseCreate, fields, now, ct);
        return ToView(draft, errors, warnings);
    }

    // ------------------------------------------------------------------- shared

    private async Task EnsureUnderLimitAsync(int tenantId, int userId, DateTime now, CancellationToken ct)
    {
        var open = await _context.AssistantDrafts.CountAsync(d => d.TenantId == tenantId && d.UserId == userId && d.Status == "Draft" && d.ExpiresAt > now, ct);
        if (open >= MaxOpenDraftsPerUser) throw new DraftException(429, "Too many drafts are waiting. Confirm or cancel some first.");
    }

    private async Task<AssistantDraft> StoreAsync<T>(int tenantId, int userId, string kind, T fields, DateTime now, CancellationToken ct)
    {
        var draft = new AssistantDraft
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Kind = kind,
            PayloadJson = JsonSerializer.Serialize(fields),
            PayloadHash = Hash(fields),
            Status = "Draft",
            CreatedAt = now,
            ExpiresAt = now + Lifetime,
        };
        _context.AssistantDrafts.Add(draft);
        await _context.SaveChangesAsync(ct);
        return draft;
    }

    private static object ReadFields(AssistantDraft d) => d.Kind == ExpenseCreate
        ? JsonSerializer.Deserialize<ExpenseDraftFields>(d.PayloadJson)!
        : JsonSerializer.Deserialize<CustomerDraftFields>(d.PayloadJson)!;

    private static List<DraftFieldError> ValidateStored(AssistantDraft d) => d.Kind == ExpenseCreate
        ? ValidateExpense(JsonSerializer.Deserialize<ExpenseDraftFields>(d.PayloadJson)!, DateTime.UtcNow)
        : Validate(JsonSerializer.Deserialize<CustomerDraftFields>(d.PayloadJson)!);

    private static DraftView ToView(AssistantDraft d, IReadOnlyList<DraftFieldError> errors, IReadOnlyList<string> warnings)
    {
        object? result = string.IsNullOrEmpty(d.ResultJson) ? null : JsonSerializer.Deserialize<JsonElement>(d.ResultJson);
        return new DraftView(d.Id, d.Kind, d.Status, ReadFields(d), errors, warnings, d.PayloadHash, d.ExpiresAt, result);
    }

    public async Task<DraftView> GetAsync(int tenantId, int userId, Guid id, CancellationToken ct)
    {
        var draft = await Load(tenantId, userId, id, ct);
        return ToView(draft, ValidateStored(draft), Array.Empty<string>());
    }

    public async Task CancelAsync(int tenantId, int userId, Guid id, CancellationToken ct)
    {
        var draft = await Load(tenantId, userId, id, ct);
        if (draft.Status == "Confirmed") throw new DraftException(409, "This draft was already confirmed and cannot be cancelled.");
        if (draft.Status == "Executing") throw new DraftException(409, "This draft is being confirmed. Check the list before trying again.");
        draft.Status = "Cancelled";
        await _context.SaveChangesAsync(ct);
    }

    public async Task<DraftView> ConfirmAsync(int tenantId, int userId, Guid id, string payloadHash, string idempotencyKey, CancellationToken ct,
        bool isStaff = false, string role = "")
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length < 8 || idempotencyKey.Length > 80)
            throw new DraftException(400, "An idempotency key of 8 to 80 characters is required.");
        var draft = await Load(tenantId, userId, id, ct);

        if (draft.Status == "Confirmed")
        {
            // Same key: the earlier answer was lost, so give it back unchanged. Another key: this is a second, different attempt.
            if (draft.IdempotencyKey == idempotencyKey) return ToView(draft, Array.Empty<DraftFieldError>(), Array.Empty<string>());
            throw new DraftException(409, "This draft was already confirmed.");
        }
        if (draft.Status == "Executing")
            throw new DraftException(409, "This draft is already being confirmed. Check the list before trying again.");
        if (draft.Status == "Cancelled") throw new DraftException(409, "This draft was cancelled.");
        if (draft.Status == "Expired" || draft.ExpiresAt <= DateTime.UtcNow)
        {
            draft.Status = "Expired";
            await _context.SaveChangesAsync(ct);
            throw new DraftException(410, "This draft has expired. Create a new one.");
        }
        if (!string.Equals(draft.PayloadHash, payloadHash, StringComparison.OrdinalIgnoreCase))
            throw new DraftException(409, "The draft changed since you reviewed it. Review it again.");

        var errors = ValidateStored(draft);
        if (errors.Count > 0) throw new DraftException(400, "Fix the highlighted fields first: " + string.Join(" ", errors.Select(e => e.Message)));

        // Claim: only one request can move Draft to Executing, so a double tap or a retry cannot create twice.
        var claimed = await _context.AssistantDrafts
            .Where(d => d.Id == id && d.TenantId == tenantId && d.Status == "Draft")
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, "Executing").SetProperty(d => d.IdempotencyKey, idempotencyKey), ct);
        if (claimed == 0) throw new DraftException(409, "This draft is already being confirmed.");

        try
        {
            var resultJson = draft.Kind == ExpenseCreate
                ? await ExecuteExpenseAsync(draft, tenantId, userId, isStaff, role, ct)
                : await ExecuteCustomerAsync(draft, tenantId, userId);

            var confirmedAt = DateTime.UtcNow;
            await _context.AssistantDrafts.Where(d => d.Id == id && d.TenantId == tenantId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(d => d.Status, "Confirmed")
                    .SetProperty(d => d.ConfirmedAt, confirmedAt)
                    .SetProperty(d => d.ResultJson, resultJson), ct);
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            // The domain service refused before writing anything (a business rule, a closed day, a locked VAT period).
            // Safe to let the person fix and try again.
            await _context.AssistantDrafts.Where(d => d.Id == id && d.TenantId == tenantId)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, "Draft").SetProperty(d => d.IdempotencyKey, d => (string?)null), ct);
            throw new DraftException(409, ex.Message);
        }
        // Any other failure may or may not have saved. The draft stays Executing so nothing retries it automatically.

        _context.ChangeTracker.Clear();
        var done = await Load(tenantId, userId, id, ct);
        _context.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "AssistantDraftConfirmed",
            Details = $"kind={done.Kind}; draft={done.Id}", CreatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync(ct);
        return ToView(done, Array.Empty<DraftFieldError>(), Array.Empty<string>());
    }

    private async Task<string> ExecuteCustomerAsync(AssistantDraft draft, int tenantId, int userId)
    {
        var f = JsonSerializer.Deserialize<CustomerDraftFields>(draft.PayloadJson)!;
        var created = await _customers.CreateCustomerAsync(new CreateCustomerRequest
        {
            Name = f.Name, Phone = f.Phone, Email = f.Email, Trn = f.Trn, Address = f.Address,
            CreditLimit = f.CreditLimit, PaymentTerms = f.PaymentTerms, CustomerType = f.CustomerType,
        }, tenantId, userId);
        return JsonSerializer.Serialize(new { customerId = created.Id, name = created.Name });
    }

    private async Task<string> ExecuteExpenseAsync(AssistantDraft draft, int tenantId, int userId, bool isStaff, string role, CancellationToken ct)
    {
        var f = JsonSerializer.Deserialize<ExpenseDraftFields>(draft.PayloadJson)!;
        // Same scope the Expenses screen applies: staff are limited to their branches and routes and their expenses start Pending.
        IReadOnlyList<int>? staffBranchIds = null;
        IReadOnlyList<int>? staffRouteIds = null;
        if (isStaff)
        {
            staffBranchIds = await _context.BranchStaff.Where(bs => bs.UserId == userId).Select(bs => bs.BranchId).ToListAsync(ct);
            staffRouteIds = await _routeScope.GetRestrictedRouteIdsAsync(userId, tenantId, role);
        }
        var date = DateTime.SpecifyKind(DateTime.ParseExact(f.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture), DateTimeKind.Utc);
        var created = await _expenses.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = f.CategoryId, Amount = f.Amount, Date = date, Note = f.Note,
            WithVat = false, IsTaxClaimable = true, PartialCreditPct = 100,
        }, userId, tenantId, staffBranchIds, staffRouteIds);
        return JsonSerializer.Serialize(new { expenseId = created.Id, amount = created.Amount, status = created.Status });
    }

    private async Task<AssistantDraft> Load(int tenantId, int userId, Guid id, CancellationToken ct)
    {
        // Another user's or another company's draft looks exactly like a missing one.
        var draft = await _context.AssistantDrafts.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.UserId == userId, ct);
        if (draft == null) throw new DraftException(404, "Draft not found.");
        return await _context.AssistantDrafts.FirstAsync(d => d.Id == id, ct);
    }
}
