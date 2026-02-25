/*
Purpose: Authentication controller for login and user management
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Auth;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HexaBill.Api.Modules.Auth
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : TenantScopedController
    {
        private readonly IAuthService _authService;
        private readonly ILoginLockoutService _lockout;
        private readonly IFileUploadService _fileUploadService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService authService, ILoginLockoutService lockout, IFileUploadService fileUploadService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _lockout = lockout;
            _fileUploadService = fileUploadService;
            _logger = logger;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest? request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new ApiResponse<LoginResponse> { Success = false, Message = "Request body is required (email and password).", Errors = new List<string>() });
                }
                var email = request.Email?.Trim().ToLowerInvariant() ?? "";
                if (string.IsNullOrEmpty(email))
                {
                    return BadRequest(new ApiResponse<LoginResponse> { Success = false, Message = "Email is required.", Errors = new List<string>() });
                }
                // BUG #2.7 FIX: Use async lockout check (persistent in PostgreSQL)
                if (await _lockout.IsLockedOutAsync(email))
                {
                    _logger.LogWarning("Login attempt for locked-out email: {Email}", email);
                    return StatusCode(429, new ApiResponse<LoginResponse> { Success = false, Message = "Too many failed attempts. Try again in 15 minutes." });
                }

                var result = await _authService.LoginAsync(request);
                if (result == null)
                {
                    await _lockout.RecordFailedAttemptAsync(email);
                    _logger.LogWarning("Failed login attempt for email: {Email}", email);
                    return BadRequest(new ApiResponse<LoginResponse> { Success = false, Message = "Invalid email or password", Errors = new List<string>() });
                }
                await _lockout.ClearAttemptsAsync(email);
                _logger.LogInformation("Login successful for user: {UserId} ({Email})", result.UserId, email);
                return Ok(new ApiResponse<LoginResponse> { Success = true, Message = "Login successful", Data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error for email: {Email}. Message: {Message}", request?.Email ?? "(null)", ex.Message);
                if (ex.InnerException != null)
                    _logger.LogError(ex.InnerException, "Login inner exception: {Message}", ex.InnerException.Message);

                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()?.IsDevelopment()
                    ?? HttpContext.RequestServices.GetService<IHostEnvironment>()?.IsDevelopment() ?? false;
                return StatusCode(500, new ApiResponse<LoginResponse>
                {
                    Success = false,
                    Message = isDevelopment ? $"An error occurred during login: {ex.Message}" : "An error occurred during login. Please try again or contact support.",
                    Errors = isDevelopment ? new List<string> { ex.ToString() ?? ex.Message } : new List<string>()
                });
            }
        }

        [HttpPost("health")]
        public Task<ActionResult<object>> Health()
        {
            try
            {
                var ok = true;
                return Task.FromResult<ActionResult<object>>(Ok(new { success = ok }));
            }
            catch
            {
                return Task.FromResult<ActionResult<object>>(StatusCode(500, new { success = false }));
            }
        }

        [HttpPost("forgot")]
        public Task<ActionResult<ApiResponse<object>>> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            try
            {
                // For now, just return success - email integration can be added later
                return Task.FromResult<ActionResult<ApiResponse<object>>>(Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Password reset instructions have been sent to your email"
                }));
            }
            catch (Exception ex)
            {
                return Task.FromResult<ActionResult<ApiResponse<object>>>(StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                }));
            }
        }

        /// <summary>
        /// Public signup endpoint - Creates tenant + owner + trial subscription
        /// </summary>
        [HttpPost("signup")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<SignupResponse>>> Signup([FromBody] SignupRequest request)
        {
            try
            {
                var signupService = HttpContext.RequestServices.GetRequiredService<ISignupService>();
                var result = await signupService.SignupAsync(request);
                
                return Ok(new ApiResponse<SignupResponse>
                {
                    Success = true,
                    Message = result.Message,
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SignupResponse>
                {
                    Success = false,
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SignupResponse>
                {
                    Success = false,
                    Message = "An error occurred during signup",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Verify email address
        /// </summary>
        [HttpPost("verify-email")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<object>>> VerifyEmail([FromBody] VerifyEmailRequest request)
        {
            try
            {
                var signupService = HttpContext.RequestServices.GetRequiredService<ISignupService>();
                var verified = await signupService.VerifyEmailAsync(request.Token);
                
                if (!verified)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Invalid or expired verification token"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Email verified successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred during email verification",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Resend verification email
        /// </summary>
        [HttpPost("resend-verification")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<object>>> ResendVerification([FromBody] ResendVerificationRequest request)
        {
            try
            {
                var signupService = HttpContext.RequestServices.GetRequiredService<ISignupService>();
                var sent = await signupService.ResendVerificationEmailAsync(request.Email);
                
                if (!sent)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Email not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Verification email sent"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("register")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<RegisterResponse>>> Register([FromBody] RegisterRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int adminUserId))
                {
                    return Unauthorized(new ApiResponse<RegisterResponse>
                    {
                        Success = false,
                        Message = "Invalid admin user"
                    });
                }

                var result = await _authService.RegisterAsync(request, adminUserId, CurrentTenantId);
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
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception)
            {
                return StatusCode(500, new ApiResponse<RegisterResponse>
                {
                    Success = false,
                    Message = "An error occurred during user registration",
                    Errors = new List<string>()
                });
            }
        }

        [HttpGet("validate")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> ValidateToken()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Invalid token"
                    });
                }

                var user = await _authService.GetUserByIdAsync(userId);
                if (user == null)
                {
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                var (branchIds, routeIds) = await _authService.GetUserAssignmentsAsync(userId);

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Token is valid",
                    Data = new 
                    { 
                        UserId = user.Id, 
                        Role = user.Role.ToString(), 
                        Name = user.Name, 
                        DashboardPermissions = user.DashboardPermissions,
                        PageAccess = user.PageAccess,
                        AssignedBranchIds = branchIds,
                        AssignedRouteIds = routeIds
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // OWNER PROFILE MANAGEMENT
        [HttpGet("profile")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetProfile()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<UserProfileDto>
                    {
                        Success = false,
                        Message = "Invalid token"
                    });
                }

                var user = await _authService.GetUserByIdAsync(userId);
                if (user == null)
                {
                    return NotFound(new ApiResponse<UserProfileDto>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                var profile = new UserProfileDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email,
                    Phone = user.Phone,
                    Role = user.Role.ToString(),
                    tenantId = user.TenantId ?? 0,
                    DashboardPermissions = user.DashboardPermissions,
                    CreatedAt = user.CreatedAt,
                    ProfilePhotoUrl = user.ProfilePhotoUrl,
                    LanguagePreference = user.LanguagePreference
                };

                return Ok(new ApiResponse<UserProfileDto>
                {
                    Success = true,
                    Message = "Profile retrieved successfully",
                    Data = profile
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<UserProfileDto>
                    {
                        Success = false,
                        Message = "Invalid token"
                    });
                }

                var result = await _authService.UpdateProfileAsync(userId, request);
                if (result == null)
                {
                    return NotFound(new ApiResponse<UserProfileDto>
                    {
                        Success = false,
                        Message = "User not found"
                    });
                }

                return Ok(new ApiResponse<UserProfileDto>
                {
                    Success = true,
                    Message = "Profile updated successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("profile/photo")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UploadProfilePhoto([FromForm] IFormFile file)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<UserProfileDto> { Success = false, Message = "Invalid token" });
                }
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ApiResponse<UserProfileDto> { Success = false, Message = "No file uploaded" });
                }
                var tenantId = CurrentTenantId;
                var relativePath = await _fileUploadService.UploadProfilePhotoAsync(file, userId, tenantId);
                var result = await _authService.SetProfilePhotoAsync(userId, relativePath);
                if (result == null)
                {
                    return NotFound(new ApiResponse<UserProfileDto> { Success = false, Message = "User not found" });
                }
                return Ok(new ApiResponse<UserProfileDto>
                {
                    Success = true,
                    Message = "Profile photo updated",
                    Data = result
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ApiResponse<UserProfileDto> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("profile/password")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Invalid token"
                    });
                }

                var success = await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
                if (!success)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Current password is incorrect"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Password changed successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}

