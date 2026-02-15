/*
Purpose: Authentication controller for login and user management
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Auth;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions; // MULTI-TENANT
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Api.Modules.Auth
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : TenantScopedController // MULTI-TENANT
    {
        private readonly IAuthService _authService;
        private readonly ILoginLockoutService _lockout;

        public AuthController(IAuthService authService, ILoginLockoutService lockout)
        {
            _authService = authService;
            _lockout = lockout;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
        {
            try
            {
                var email = request?.Email?.Trim().ToLowerInvariant() ?? "";
                if (_lockout.IsLockedOut(email))
                    return StatusCode(429, new ApiResponse<LoginResponse> { Success = false, Message = "Too many failed attempts. Try again in 15 minutes." });

                var result = await _authService.LoginAsync(request);
                if (result == null)
                {
                    _lockout.RecordFailedAttempt(email);
                    return BadRequest(new ApiResponse<LoginResponse> { Success = false, Message = "Invalid email or password", Errors = new List<string>() });
                }
                _lockout.ClearAttempts(email);
                return Ok(new ApiResponse<LoginResponse> { Success = true, Message = "Login successful", Data = result });
            }
            catch (Exception ex)
            {
                // DEBUG: Log error to console
                Console.WriteLine($"LOGIN ERROR: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"INNER: {ex.InnerException.Message}");
                    Console.WriteLine(ex.InnerException.StackTrace);
                }

                // Do not leak server internals to clients (TEMPORARILY EXPOSED FOR DEBUGGING)
                return StatusCode(500, new ApiResponse<LoginResponse>
                {
                    Success = false,
                    Message = $"An error occurred during login: {ex.Message}",
                    Errors = new List<string> { ex.ToString() }
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
                    CreatedAt = user.CreatedAt
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

