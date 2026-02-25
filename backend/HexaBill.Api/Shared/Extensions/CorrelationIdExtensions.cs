/*
Purpose: Correlation ID extensions for structured logging
Author: AI Assistant
Date: 2026-02-18
PROD-18: Structured logging with correlation IDs for request tracing
*/
using Microsoft.AspNetCore.Http;

namespace HexaBill.Api.Shared.Extensions
{
    /// <summary>
    /// PROD-18: Extensions for managing correlation IDs in HttpContext
    /// Ensures consistent correlation ID usage across all middleware and services
    /// </summary>
    public static class CorrelationIdExtensions
    {
        private const string CorrelationIdKey = "CorrelationId";

        /// <summary>
        /// Gets the correlation ID from HttpContext, or creates a new one if not present
        /// </summary>
        public static string GetCorrelationId(this HttpContext context)
        {
            if (context.Items.TryGetValue(CorrelationIdKey, out var correlationId) && correlationId is string id)
            {
                return id;
            }

            // Create new correlation ID if not present
            var newId = Guid.NewGuid().ToString("N")[..12];
            context.Items[CorrelationIdKey] = newId;
            return newId;
        }

        /// <summary>
        /// Sets the correlation ID in HttpContext
        /// </summary>
        public static void SetCorrelationId(this HttpContext context, string correlationId)
        {
            context.Items[CorrelationIdKey] = correlationId;
        }

        /// <summary>
        /// Gets the correlation ID from HttpContext, or returns null if not present
        /// </summary>
        public static string? GetCorrelationIdOrNull(this HttpContext context)
        {
            if (context.Items.TryGetValue(CorrelationIdKey, out var correlationId) && correlationId is string id)
            {
                return id;
            }
            return null;
        }
    }
}
