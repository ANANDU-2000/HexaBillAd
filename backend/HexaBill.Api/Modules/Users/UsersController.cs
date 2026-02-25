/*
Purpose: Users controller for Admin to manage users (Staff and Admin)
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Modules.Users;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Extensions; // CRITICAL: Required for TenantScopedController
using HexaBill.Api.Modules.Auth;

namespace HexaBill.Api.Modules.Users
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : TenantScopedController // MULTI-TENANT: Owner-scoped user management
    {
        private readonly IAuthService _authService;
        private readonly AppDbContext _context;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IAuthService authService, AppDbContext context, ILogger<UsersController> logger)
        {
            _authService = authService;
            _context = context;
            _logger = logger;
        }

        // GET: api/users - Get all users (Admin and Owner)
        [HttpGet]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UserDto>>>> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] string? role = null)
        {
            try
            {
                // CRITICAL FIX: Filter users by owner_id for multi-tenant isolation
                var tenantId = CurrentTenantId;
                var query = _context.Users
                    .Where(u => u.TenantId == tenantId); // SECURITY: Only show users belonging to current owner

                // Filter by role
                if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, true, out var roleEnum))
                {
                    query = query.Where(u => u.Role == roleEnum);
                }

                // Search filter
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(u => 
                        u.Name.Contains(search) || 
                        u.Email.Contains(search) ||
                        (u.Phone != null && u.Phone.Contains(search)));
                }

                var totalCount = await query.CountAsync();
                var users = await query
                    .OrderBy(u => u.Name)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(u => new UserDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Email = u.Email,
                        Role = u.Role.ToString(),
                        Phone = u.Phone,
                        DashboardPermissions = u.DashboardPermissions,
                        PageAccess = u.PageAccess,
                        CreatedAt = u.CreatedAt,
                        LastLoginAt = u.LastLoginAt,
                        LastActiveAt = u.LastActiveAt,
                        AssignedBranchIds = _context.BranchStaff.Where(bs => bs.UserId == u.Id).Select(bs => bs.BranchId).ToList(),
                        AssignedRouteIds = _context.RouteStaff.Where(rs => rs.UserId == u.Id).Select(rs => rs.RouteId).ToList()
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<UserDto>>
                {
                    Success = true,
                    Message = "Users retrieved successfully",
                    Data = new PagedResponse<UserDto>
                    {
                        Items = users,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<UserDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // PATCH: api/users/me/ping - Update current user's LastActiveAt for staff online indicator (Phase 6)
        [HttpPatch("me/ping")]
        public async Task<ActionResult<ApiResponse<object>>> PingMe()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object> { Success = false, Message = "Invalid user" });
                }
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    // Avoid 404 when token valid but user row missing (e.g. seed mismatch); ping is best-effort
                    return Ok(new ApiResponse<object> { Success = true, Data = new { lastActiveAt = (DateTime?)null } });
                }
                user.LastActiveAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<object> { Success = true, Data = new { lastActiveAt = user.LastActiveAt } });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PingMe Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                
                return StatusCode(500, new ApiResponse<object> 
                { 
                    Success = false, 
                    Message = "An error occurred while updating user activity",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message }.Where(s => !string.IsNullOrEmpty(s)).ToList()
                });
            }
        }

        // GET: api/users/me/assigned-routes - Returns current user's assigned routes (server-side truth for Staff)
        [HttpGet("me/assigned-routes")]
        public async Task<ActionResult<ApiResponse<object>>> GetMyAssignedRoutes()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object> { Success = false, Message = "Invalid user" });
                }
                var tenantId = CurrentTenantId;
                if (tenantId <= 0)
                {
                    return Ok(new ApiResponse<object> { Success = true, Data = new { assignedRouteIds = Array.Empty<int>(), assignedBranchIds = Array.Empty<int>() } });
                }
                var (branchIds, routeIds) = await _authService.GetUserAssignmentsAsync(userId);
                // Include routes where user is AssignedStaffId
                var assignedStaffRouteIds = await _context.Routes
                    .Where(r => r.TenantId == tenantId && r.AssignedStaffId == userId)
                    .Select(r => r.Id)
                    .ToListAsync();
                var allRouteIds = routeIds.Union(assignedStaffRouteIds).Distinct().ToList();
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Data = new { assignedRouteIds = allRouteIds, assignedBranchIds = branchIds }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        // GET: api/users/{id} - Get user by ID (Admin and Owner)
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<UserDto>>> GetUser(int id)
        {
            try
            {
                // CRITICAL FIX: Filter user by owner_id for multi-tenant isolation
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .Where(u => u.Id == id && u.TenantId == tenantId) // SECURITY: Only access users belonging to current owner
                    .Select(u => new UserDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Email = u.Email,
                        Role = u.Role.ToString(),
                        Phone = u.Phone,
                        DashboardPermissions = u.DashboardPermissions,
                        PageAccess = u.PageAccess,
                        CreatedAt = u.CreatedAt,
                        LastLoginAt = u.LastLoginAt,
                        LastActiveAt = u.LastActiveAt,
                        AssignedBranchIds = _context.BranchStaff.Where(bs => bs.UserId == u.Id).Select(bs => bs.BranchId).ToList(),
                        AssignedRouteIds = _context.RouteStaff.Where(rs => rs.UserId == u.Id).Select(rs => rs.RouteId).ToList()
                    })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    return NotFound(new ApiResponse<UserDto>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                return Ok(new ApiResponse<UserDto>
                {
                    Success = true,
                    Message = "User retrieved successfully",
                    Data = user
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // POST: api/users - Create new user (Admin and Owner can create Staff)
        [HttpPost]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<RegisterResponse>>> CreateUser([FromBody] CreateUserRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int currentUserId))
                {
                    return Unauthorized(new ApiResponse<RegisterResponse>
                    {
                        Success = false,
                        Message = "Invalid user"
                    });
                }

                // Validate role
                if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
                {
                    return BadRequest(new ApiResponse<RegisterResponse>
                    {
                        Success = false,
                        Message = "Invalid role. Must be 'Admin' or 'Staff'"
                    });
                }

                // Convert to RegisterRequest
                var registerRequest = new RegisterRequest
                {
                    Name = request.Name,
                    Email = request.Email,
                    Password = request.Password,
                    Role = request.Role,
                    Phone = request.Phone,
                    DashboardPermissions = request.DashboardPermissions,
                    PageAccess = request.PageAccess
                };

                var result = await _authService.RegisterAsync(registerRequest, currentUserId, CurrentTenantId);

                var tenantId = CurrentTenantId;

                // Assign branches and routes if provided (SECURITY: only IDs belonging to current tenant)
                if ((request.AssignedBranchIds != null && request.AssignedBranchIds.Any()) ||
                    (request.AssignedRouteIds != null && request.AssignedRouteIds.Any()))
                {
                    if (request.AssignedBranchIds != null)
                    {
                        var validBranchIds = await _context.Branches
                            .Where(b => request.AssignedBranchIds.Contains(b.Id) && b.TenantId == tenantId)
                            .Select(b => b.Id)
                            .ToListAsync();
                        foreach (var branchId in validBranchIds)
                        {
                            _context.BranchStaff.Add(new BranchStaff
                            {
                                UserId = result.UserId,
                                BranchId = branchId,
                                AssignedAt = DateTime.UtcNow
                            });
                        }
                    }

                    if (request.AssignedRouteIds != null)
                    {
                        var validRouteIds = await _context.Routes
                            .Where(r => request.AssignedRouteIds.Contains(r.Id) && r.TenantId == tenantId)
                            .Select(r => r.Id)
                            .ToListAsync();
                        foreach (var routeId in validRouteIds)
                        {
                            _context.RouteStaff.Add(new RouteStaff
                            {
                                UserId = result.UserId,
                                RouteId = routeId,
                                AssignedAt = DateTime.UtcNow
                            });
                        }
                    }

                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<RegisterResponse>
                {
                    Success = true,
                    Message = "User created successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<RegisterResponse>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<RegisterResponse>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // PUT: api/users/{id} - Update user (Admin and Owner)
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(int id, [FromBody] UpdateUserRequest? request)
        {
            if (request == null)
            {
                return BadRequest(new ApiResponse<UserDto> { Success = false, Message = "Request body is required" });
            }
            try
            {
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId); // SECURITY: Only update users belonging to current owner
                if (user == null)
                {
                    return NotFound(new ApiResponse<UserDto>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                // Update fields
                if (!string.IsNullOrEmpty(request.Name))
                {
                    user.Name = request.Name.Trim();
                }

                if (!string.IsNullOrEmpty(request.Phone))
                {
                    user.Phone = request.Phone.Trim();
                }

                // Update role if provided
                if (!string.IsNullOrEmpty(request.Role))
                {
                    if (Enum.TryParse<UserRole>(request.Role, true, out var newRole))
                    {
                        user.Role = newRole;
                    }
                    else
                    {
                        return BadRequest(new ApiResponse<UserDto>
                        {
                            Success = false,
                            Message = "Invalid role. Must be 'Owner', 'Admin', or 'Staff'"
                        });
                    }
                }

                // Update DashboardPermissions if provided
                if (request.DashboardPermissions != null)
                {
                    user.DashboardPermissions = string.IsNullOrWhiteSpace(request.DashboardPermissions) ? null : request.DashboardPermissions;
                }

                // Update PageAccess if provided
                if (request.PageAccess != null)
                {
                    user.PageAccess = string.IsNullOrWhiteSpace(request.PageAccess) ? null : request.PageAccess;
                }

                await _context.SaveChangesAsync();

                // Update assignments (SECURITY: only IDs belonging to current tenant). Empty list = clear all.
                if (request.AssignedBranchIds != null)
                {
                    var branchIds = request.AssignedBranchIds.Where(x => x > 0).ToList();
                    var validBranchIds = branchIds.Count > 0
                        ? await _context.Branches
                            .Where(b => branchIds.Contains(b.Id) && b.TenantId == tenantId)
                            .Select(b => b.Id)
                            .ToListAsync()
                        : new List<int>();
                    var existing = await _context.BranchStaff.Where(bs => bs.UserId == id).ToListAsync();
                    _context.BranchStaff.RemoveRange(existing);
                    foreach (var branchId in validBranchIds)
                    {
                        _context.BranchStaff.Add(new BranchStaff
                        {
                            UserId = id,
                            BranchId = branchId,
                            AssignedAt = DateTime.UtcNow
                        });
                    }
                    await _context.SaveChangesAsync();
                }

                if (request.AssignedRouteIds != null)
                {
                    var routeIds = request.AssignedRouteIds.Where(x => x > 0).ToList();
                    var validRouteIds = routeIds.Count > 0
                        ? await _context.Routes
                            .Where(r => routeIds.Contains(r.Id) && r.TenantId == tenantId)
                            .Select(r => r.Id)
                            .ToListAsync()
                        : new List<int>();
                    var existingRaw = await _context.RouteStaff.Where(rs => rs.UserId == id).ToListAsync();
                    _context.RouteStaff.RemoveRange(existingRaw);
                    foreach (var routeId in validRouteIds)
                    {
                        _context.RouteStaff.Add(new RouteStaff
                        {
                            UserId = id,
                            RouteId = routeId,
                            AssignedAt = DateTime.UtcNow
                        });
                    }
                    await _context.SaveChangesAsync();
                }

                // Create audit log (OwnerId required by schema)
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int currentUserId))
                {
                    try
                    {
                        _context.AuditLogs.Add(new AuditLog
                        {
                            UserId = currentUserId,
                            OwnerId = tenantId,
                            TenantId = tenantId,
                            Action = "User Updated",
                            Details = $"Updated user: {user.Email}",
                            CreatedAt = DateTime.UtcNow
                        });
                        await _context.SaveChangesAsync();
                    }
                    catch (Exception auditEx)
                    {
                        _logger.LogWarning(auditEx, "Audit log failed (user update) for user id={UserId}", id);
                    }
                }

                var userDto = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email,
                    Role = user.Role.ToString(),
                    Phone = user.Phone,
                    DashboardPermissions = user.DashboardPermissions,
                    PageAccess = user.PageAccess,
                    CreatedAt = user.CreatedAt,
                    LastLoginAt = user.LastLoginAt,
                    LastActiveAt = user.LastActiveAt,
                    AssignedBranchIds = await _context.BranchStaff.Where(bs => bs.UserId == user.Id).Select(bs => bs.BranchId).ToListAsync(),
                    AssignedRouteIds = await _context.RouteStaff.Where(rs => rs.UserId == user.Id).Select(rs => rs.RouteId).ToListAsync()
                };

                return Ok(new ApiResponse<UserDto>
                {
                    Success = true,
                    Message = "User updated successfully",
                    Data = userDto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateUser failed for id={Id}", id);
                var errMsg = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new ApiResponse<UserDto>
                {
                    Success = false,
                    Message = errMsg,
                    Errors = new List<string> { errMsg }
                });
            }
        }

        // PUT: api/users/{id}/reset-password - Reset user password (Admin and Owner)
        [HttpPut("{id}/reset-password")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
        {
            try
            {
                // CRITICAL FIX: Filter by owner_id for multi-tenant isolation
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId); // SECURITY: Only reset password for users belonging to current owner
                if (user == null)
                {
                    return NotFound(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                // Hash new password
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                await _context.SaveChangesAsync();

                // Create audit log
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int currentUserId))
                {
                    var auditLog = new AuditLog
                    {
                        UserId = currentUserId,
                        TenantId = tenantId,
                        Action = "Password Reset",
                        Details = $"Password reset for user: {user.Email}",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(auditLog);
                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Password reset successfully",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // DELETE: api/users/{id} - Delete user (Admin and Owner)
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteUser(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int currentUserId))
                {
                    return Unauthorized(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invalid user"
                    });
                }

                // Prevent deleting yourself
                if (id == currentUserId)
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "You cannot delete your own account"
                    });
                }

                // CRITICAL FIX: Filter by owner_id for multi-tenant isolation
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId); // SECURITY: Only delete users belonging to current owner
                if (user == null)
                {
                    return NotFound(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                // Check if user has any associated records (sales, etc.) - CRITICAL: filter by tenant for data isolation
                var hasSales = await _context.Sales.AnyAsync(s => s.TenantId == tenantId && (s.CreatedBy == id || s.LastModifiedBy == id));
                if (hasSales)
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Cannot delete user with associated transactions. Consider deactivating instead."
                    });
                }

                _context.Users.Remove(user);
                await _context.SaveChangesAsync();

                // Create audit log
                var auditLog = new AuditLog
                {
                    UserId = currentUserId,
                    TenantId = tenantId,
                    Action = "User Deleted",
                    Details = $"Deleted user: {user.Email}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "User deleted successfully",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}

