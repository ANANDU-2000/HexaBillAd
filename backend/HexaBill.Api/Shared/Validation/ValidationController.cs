/*
Purpose: Admin validation controller for balance verification and fixes
Author: AI Assistant
Date: 2025-11-11
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Shared.Validation;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;

namespace HexaBill.Api.Shared.Validation
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ValidationController : ControllerBase
    {
        private readonly IBalanceService _balanceService;
        private readonly ILogger<ValidationController> _logger;

        public ValidationController(
            IBalanceService balanceService,
            ILogger<ValidationController> logger)
        {
            _balanceService = balanceService;
            _logger = logger;
        }

        /// <summary>
        /// Validate balance for specific customer
        /// </summary>
        [HttpGet("customer/{customerId}")]
        public async Task<ActionResult<ApiResponse<BalanceValidationResult>>> ValidateCustomerBalance(int customerId)
        {
            try
            {
                var result = await _balanceService.ValidateCustomerBalanceAsync(customerId);
                return Ok(new ApiResponse<BalanceValidationResult>
                {
                    Success = result.IsValid,
                    Message = result.IsValid ? "Balance is valid" : "Balance mismatch detected",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating customer {CustomerId} balance", customerId);
                return StatusCode(500, new ApiResponse<BalanceValidationResult>
                {
                    Success = false,
                    Message = "Failed to validate balance",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Detect all balance mismatches across all customers
        /// </summary>
        [HttpGet("detect-mismatches")]
        public async Task<ActionResult<ApiResponse<List<BalanceMismatch>>>> DetectAllMismatches()
        {
            try
            {
                var mismatches = await _balanceService.DetectAllBalanceMismatchesAsync();
                return Ok(new ApiResponse<List<BalanceMismatch>>
                {
                    Success = true,
                    Message = $"Found {mismatches.Count} balance mismatch(es)",
                    Data = mismatches
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error detecting balance mismatches");
                return StatusCode(500, new ApiResponse<List<BalanceMismatch>>
                {
                    Success = false,
                    Message = "Failed to detect mismatches",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Fix balance mismatch for specific customer
        /// </summary>
        [HttpPost("fix-customer/{customerId}")]
        public async Task<ActionResult<ApiResponse<bool>>> FixCustomerBalance(int customerId)
        {
            try
            {
                var success = await _balanceService.FixBalanceMismatchAsync(customerId);
                return Ok(new ApiResponse<bool>
                {
                    Success = success,
                    Message = success ? "Balance fixed successfully" : "Failed to fix balance",
                    Data = success
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing customer {CustomerId} balance", customerId);
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Failed to fix balance",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Fix all detected balance mismatches
        /// </summary>
        [HttpPost("fix-all")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, object>>>> FixAllMismatches()
        {
            try
            {
                var mismatches = await _balanceService.DetectAllBalanceMismatchesAsync();
                var results = new Dictionary<string, object>();
                var successCount = 0;
                var failCount = 0;

                foreach (var mismatch in mismatches)
                {
                    var success = await _balanceService.FixBalanceMismatchAsync(mismatch.CustomerId);
                    if (success) successCount++;
                    else failCount++;
                }

                results["TotalMismatches"] = mismatches.Count;
                results["Fixed"] = successCount;
                results["Failed"] = failCount;

                return Ok(new ApiResponse<Dictionary<string, object>>
                {
                    Success = failCount == 0,
                    Message = $"Fixed {successCount} of {mismatches.Count} mismatches",
                    Data = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing all balance mismatches");
                return StatusCode(500, new ApiResponse<Dictionary<string, object>>
                {
                    Success = false,
                    Message = "Failed to fix all mismatches",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Recalculate balance for specific customer (force refresh)
        /// </summary>
        [HttpPost("recalculate/{customerId}")]
        public async Task<ActionResult<ApiResponse<bool>>> RecalculateCustomerBalance(int customerId)
        {
            try
            {
                await _balanceService.RecalculateCustomerBalanceAsync(customerId);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Balance recalculated successfully",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recalculating customer {CustomerId} balance", customerId);
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Failed to recalculate balance",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
