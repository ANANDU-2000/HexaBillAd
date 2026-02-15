/*
Purpose: Subscription Management Controller
Author: AI Assistant
Date: 2026-02-11
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Subscription
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SubscriptionController : TenantScopedController
    {
        private readonly ISubscriptionService _subscriptionService;

        public SubscriptionController(ISubscriptionService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        /// <summary>
        /// Get all available subscription plans
        /// </summary>
        [HttpGet("plans")]
        public async Task<ActionResult<ApiResponse<List<SubscriptionPlanDto>>>> GetPlans()
        {
            try
            {
                var plans = await _subscriptionService.GetPlansAsync();
                return Ok(new ApiResponse<List<SubscriptionPlanDto>>
                {
                    Success = true,
                    Message = "Plans retrieved successfully",
                    Data = plans
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<SubscriptionPlanDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Get plan by ID
        /// </summary>
        [HttpGet("plans/{id}")]
        public async Task<ActionResult<ApiResponse<SubscriptionPlanDto>>> GetPlan(int id)
        {
            try
            {
                var plan = await _subscriptionService.GetPlanByIdAsync(id);
                if (plan == null)
                {
                    return NotFound(new ApiResponse<SubscriptionPlanDto>
                    {
                        Success = false,
                        Message = "Plan not found"
                    });
                }

                return Ok(new ApiResponse<SubscriptionPlanDto>
                {
                    Success = true,
                    Message = "Plan retrieved successfully",
                    Data = plan
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionPlanDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Get current tenant's subscription
        /// </summary>
        [HttpGet("current")]
        public async Task<ActionResult<ApiResponse<SubscriptionDto>>> GetCurrentSubscription()
        {
            try
            {
                var subscription = await _subscriptionService.GetTenantSubscriptionAsync(CurrentTenantId);
                if (subscription == null)
                {
                    return NotFound(new ApiResponse<SubscriptionDto>
                    {
                        Success = false,
                        Message = "No subscription found"
                    });
                }

                return Ok(new ApiResponse<SubscriptionDto>
                {
                    Success = true,
                    Message = "Subscription retrieved successfully",
                    Data = subscription
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Create new subscription (for tenant)
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<ApiResponse<SubscriptionDto>>> CreateSubscription([FromBody] CreateSubscriptionRequest request)
        {
            try
            {
                var subscription = await _subscriptionService.CreateSubscriptionAsync(
                    CurrentTenantId,
                    request.PlanId,
                    request.BillingCycle ?? BillingCycle.Monthly
                );

                return CreatedAtAction(nameof(GetCurrentSubscription), null, new ApiResponse<SubscriptionDto>
                {
                    Success = true,
                    Message = "Subscription created successfully",
                    Data = subscription
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SubscriptionDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Update subscription (upgrade/downgrade plan or change billing cycle)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<SubscriptionDto>>> UpdateSubscription(int id, [FromBody] UpdateSubscriptionRequest request)
        {
            try
            {
                // Verify subscription belongs to current tenant
                var currentSubscription = await _subscriptionService.GetTenantSubscriptionAsync(CurrentTenantId);
                if (currentSubscription == null || currentSubscription.Id != id)
                {
                    return Forbid();
                }

                var subscription = await _subscriptionService.UpdateSubscriptionAsync(
                    id,
                    request.PlanId,
                    request.BillingCycle
                );

                return Ok(new ApiResponse<SubscriptionDto>
                {
                    Success = true,
                    Message = "Subscription updated successfully",
                    Data = subscription
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new ApiResponse<SubscriptionDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Cancel subscription
        /// </summary>
        [HttpPost("{id}/cancel")]
        public async Task<ActionResult<ApiResponse<object>>> CancelSubscription(int id, [FromBody] CancelSubscriptionRequest request)
        {
            try
            {
                // Verify subscription belongs to current tenant
                var currentSubscription = await _subscriptionService.GetTenantSubscriptionAsync(CurrentTenantId);
                if (currentSubscription == null || currentSubscription.Id != id)
                {
                    return Forbid();
                }

                var success = await _subscriptionService.CancelSubscriptionAsync(id, request.Reason ?? "Cancelled by user");
                if (!success)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Subscription not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Subscription cancelled successfully"
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

        /// <summary>
        /// Renew subscription
        /// </summary>
        [HttpPost("{id}/renew")]
        public async Task<ActionResult<ApiResponse<object>>> RenewSubscription(int id)
        {
            try
            {
                // Verify subscription belongs to current tenant
                var currentSubscription = await _subscriptionService.GetTenantSubscriptionAsync(CurrentTenantId);
                if (currentSubscription == null || currentSubscription.Id != id)
                {
                    return Forbid();
                }

                var success = await _subscriptionService.RenewSubscriptionAsync(id);
                if (!success)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Subscription not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Subscription renewed successfully"
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

        /// <summary>
        /// Get subscription limits for current tenant
        /// </summary>
        [HttpGet("limits")]
        public async Task<ActionResult<ApiResponse<SubscriptionLimitsDto>>> GetLimits()
        {
            try
            {
                var limits = await _subscriptionService.GetTenantLimitsAsync(CurrentTenantId);
                return Ok(new ApiResponse<SubscriptionLimitsDto>
                {
                    Success = true,
                    Message = "Limits retrieved successfully",
                    Data = limits
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionLimitsDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Check if feature is allowed (for current tenant)
        /// </summary>
        [HttpGet("features/{feature}")]
        public async Task<ActionResult<ApiResponse<bool>>> CheckFeature(string feature)
        {
            try
            {
                var allowed = await _subscriptionService.IsFeatureAllowedAsync(CurrentTenantId, feature);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Feature check completed",
                    Data = allowed
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

        /// <summary>
        /// Get platform subscription metrics (SystemAdmin only)
        /// </summary>
        [HttpGet("metrics")]
        public async Task<ActionResult<ApiResponse<SubscriptionMetricsDto>>> GetMetrics()
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var metrics = await _subscriptionService.GetPlatformMetricsAsync();
                return Ok(new ApiResponse<SubscriptionMetricsDto>
                {
                    Success = true,
                    Message = "Metrics retrieved successfully",
                    Data = metrics
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionMetricsDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }

    public class CreateSubscriptionRequest
    {
        public int PlanId { get; set; }
        public BillingCycle? BillingCycle { get; set; }
    }

    public class UpdateSubscriptionRequest
    {
        public int? PlanId { get; set; }
        public BillingCycle? BillingCycle { get; set; }
    }

    public class CancelSubscriptionRequest
    {
        public string? Reason { get; set; }
    }
}
