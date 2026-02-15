using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Auth;
using HexaBill.Api.Modules.Subscription;

namespace HexaBill.Api.Modules.SuperAdmin;

public interface IDemoRequestService
{
    Task<DemoRequestDto> CreateDemoRequestAsync(CreateDemoRequestDto request);
    Task<PagedResponse<DemoRequestDto>> GetDemoRequestsAsync(int page = 1, int pageSize = 20, DemoRequestStatus? status = null);
    Task<DemoRequestDto?> GetDemoRequestByIdAsync(int id);
    Task<bool> ApproveDemoRequestAsync(int id, int planId, int trialDays, int processedByUserId);
    Task<bool> RejectDemoRequestAsync(int id, string reason, int processedByUserId);
    Task<bool> ConvertToTenantAsync(int demoRequestId, int processedByUserId);
}

public class DemoRequestService : IDemoRequestService
{
    private readonly AppDbContext _context;
    private readonly ISignupService _signupService;
    private readonly ILogger<DemoRequestService> _logger;

    public DemoRequestService(AppDbContext context, ISignupService signupService, ILogger<DemoRequestService> logger)
    {
        _context = context;
        _signupService = signupService;
        _logger = logger;
    }

    public async Task<DemoRequestDto> CreateDemoRequestAsync(CreateDemoRequestDto request)
    {
        var demo = new DemoRequest
        {
            CompanyName = request.CompanyName,
            ContactName = request.ContactName,
            WhatsApp = request.WhatsApp,
            Email = request.Email,
            Country = request.Country ?? "AE",
            Industry = request.Industry,
            MonthlySalesRange = request.MonthlySalesRange,
            StaffCount = request.StaffCount,
            Status = DemoRequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        _context.DemoRequests.Add(demo);
        await _context.SaveChangesAsync();
        return MapToDto(demo);
    }

    public async Task<PagedResponse<DemoRequestDto>> GetDemoRequestsAsync(int page = 1, int pageSize = 20, DemoRequestStatus? status = null)
    {
        pageSize = Math.Min(pageSize, 100);
        var query = _context.DemoRequests.AsQueryable();
        if (status.HasValue) query = query.Where(d => d.Status == status.Value);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(d => MapToDto(d)).ToListAsync();
        return new PagedResponse<DemoRequestDto>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling((double)total / pageSize)
        };
    }

    public async Task<DemoRequestDto?> GetDemoRequestByIdAsync(int id)
    {
        var demo = await _context.DemoRequests.FindAsync(id);
        return demo != null ? MapToDto(demo) : null;
    }

    public async Task<bool> ApproveDemoRequestAsync(int id, int planId, int trialDays, int processedByUserId)
    {
        var demo = await _context.DemoRequests.FindAsync(id);
        if (demo == null || demo.Status != DemoRequestStatus.Pending) return false;
        demo.Status = DemoRequestStatus.Approved;
        demo.AssignedPlanId = planId;
        demo.ProcessedAt = DateTime.UtcNow;
        demo.ProcessedByUserId = processedByUserId;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RejectDemoRequestAsync(int id, string reason, int processedByUserId)
    {
        var demo = await _context.DemoRequests.FindAsync(id);
        if (demo == null || demo.Status != DemoRequestStatus.Pending) return false;
        demo.Status = DemoRequestStatus.Rejected;
        demo.RejectionReason = reason;
        demo.ProcessedAt = DateTime.UtcNow;
        demo.ProcessedByUserId = processedByUserId;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ConvertToTenantAsync(int demoRequestId, int processedByUserId)
    {
        var demo = await _context.DemoRequests.FindAsync(demoRequestId);
        if (demo == null || demo.Status != DemoRequestStatus.Approved || demo.CreatedTenantId.HasValue) return false;
        try
        {
            var tenant = await _signupService.CreateTenantFromDemoAsync(new CreateTenantFromDemoDto
            {
                CompanyName = demo.CompanyName,
                ContactName = demo.ContactName,
                Email = demo.Email,
                Country = demo.Country,
                PlanId = demo.AssignedPlanId ?? 1,
                TrialDays = 14
            });
            demo.CreatedTenantId = tenant.Id;
            demo.Status = DemoRequestStatus.Converted;
            demo.ProcessedAt = DateTime.UtcNow;
            demo.ProcessedByUserId = processedByUserId;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert demo request {Id} to tenant", demoRequestId);
            return false;
        }
    }

    private static DemoRequestDto MapToDto(DemoRequest d) => new()
    {
        Id = d.Id,
        CompanyName = d.CompanyName,
        ContactName = d.ContactName,
        WhatsApp = d.WhatsApp,
        Email = d.Email,
        Country = d.Country,
        Industry = d.Industry,
        MonthlySalesRange = d.MonthlySalesRange,
        StaffCount = d.StaffCount,
        Status = d.Status.ToString(),
        RejectionReason = d.RejectionReason,
        AssignedPlanId = d.AssignedPlanId,
        CreatedTenantId = d.CreatedTenantId,
        CreatedAt = d.CreatedAt,
        ProcessedAt = d.ProcessedAt
    };
}

public class DemoRequestDto
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string WhatsApp { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string MonthlySalesRange { get; set; } = string.Empty;
    public int StaffCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public int? AssignedPlanId { get; set; }
    public int? CreatedTenantId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class CreateDemoRequestDto
{
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string WhatsApp { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Country { get; set; }
    public string Industry { get; set; } = string.Empty;
    public string MonthlySalesRange { get; set; } = string.Empty;
    public int StaffCount { get; set; }
}
