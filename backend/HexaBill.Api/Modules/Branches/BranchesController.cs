/*
 * Branches API - tenant-scoped branch CRUD and branch summary.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BranchesController : TenantScopedController
    {
        private readonly IBranchService _branchService;

        public BranchesController(IBranchService branchService)
        {
            _branchService = branchService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<BranchDto>>>> GetBranches()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                var list = await _branchService.GetBranchesAsync(tenantId);
                return Ok(new ApiResponse<List<BranchDto>> { Success = true, Data = list });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetBranches Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                return StatusCode(500, new ApiResponse<List<BranchDto>>
                {
                    Success = false,
                    Message = "Failed to load branches. Check that the Branches table exists and migrations are applied.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<BranchDto>>> GetBranch(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var branch = await _branchService.GetBranchByIdAsync(id, tenantId);
            if (branch == null) return NotFound(new ApiResponse<BranchDto> { Success = false, Message = "Branch not found." });
            return Ok(new ApiResponse<BranchDto> { Success = true, Data = branch });
        }

        [HttpGet("{id}/summary")]
        public async Task<ActionResult<ApiResponse<BranchSummaryDto>>> GetBranchSummary(int id, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var summary = await _branchService.GetBranchSummaryAsync(id, tenantId, fromDate, toDate);
            if (summary == null) return NotFound(new ApiResponse<BranchSummaryDto> { Success = false, Message = "Branch not found." });
            return Ok(new ApiResponse<BranchSummaryDto> { Success = true, Data = summary });
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<BranchDto>>> CreateBranch([FromBody] CreateBranchRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                
                // SECURITY: Prevent Super Admin from creating global branches (TenantId=0)
                // They must select a tenant first (impersonation)
                if (tenantId <= 0 && IsSystemAdmin)
                {
                    return BadRequest(new ApiResponse<BranchDto> 
                    { 
                        Success = false, 
                        Message = "Super Admin must select a company (tenant) before creating a branch." 
                    });
                }

                var branch = await _branchService.CreateBranchAsync(request, tenantId);
                return CreatedAtAction(nameof(GetBranch), new { id = branch.Id }, new ApiResponse<BranchDto> { Success = true, Data = branch });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ CreateBranch Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                return StatusCode(500, new ApiResponse<BranchDto>
                {
                    Success = false,
                    Message = "Failed to create branch. Check that the tenant exists and database is accessible.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<BranchDto>>> UpdateBranch(int id, [FromBody] CreateBranchRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var branch = await _branchService.UpdateBranchAsync(id, request, tenantId);
            if (branch == null) return NotFound(new ApiResponse<BranchDto> { Success = false, Message = "Branch not found." });
            return Ok(new ApiResponse<BranchDto> { Success = true, Data = branch });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteBranch(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _branchService.DeleteBranchAsync(id, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Branch not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Branch deleted." });
        }
    }
}
