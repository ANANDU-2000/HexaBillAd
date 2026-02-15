/*
Purpose: Currency service for multi-currency support
Author: AI Assistant
Date: 2024
*/
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HexaBill.Api.Shared.Validation
{
    public interface ICurrencyService
    {
        Task<string> GetDefaultCurrencyAsync();
        Task SetDefaultCurrencyAsync(string currency);
        Task<decimal> ConvertCurrencyAsync(decimal amount, string fromCurrency, string toCurrency);
        Task<Dictionary<string, decimal>> GetExchangeRatesAsync();
        Task UpdateExchangeRateAsync(string currency, decimal rate);
        string FormatCurrency(decimal amount, string? currency = null);
    }

    public class CurrencyService : ICurrencyService
    {
        private readonly AppDbContext _context;
        private readonly Dictionary<string, decimal> _exchangeRates;

        public CurrencyService(AppDbContext context)
        {
            _context = context;
            _exchangeRates = new Dictionary<string, decimal>
            {
                { "AED", 1.0m },      // Base currency
                { "INR", 22.5m },     // 1 AED = 22.5 INR
                { "USD", 0.27m },     // 1 AED = 0.27 USD
                { "EUR", 0.25m }      // 1 AED = 0.25 EUR
            };
        }

        public async Task<string> GetDefaultCurrencyAsync()
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "default_currency");
            
            return setting?.Value ?? "AED";
        }

        public async Task SetDefaultCurrencyAsync(string currency)
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "default_currency");

            if (setting == null)
            {
                setting = new Setting
                {
                    Key = "default_currency",
                    Value = currency,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(setting);
            }
            else
            {
                setting.Value = currency;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<decimal> ConvertCurrencyAsync(decimal amount, string fromCurrency, string toCurrency)
        {
            if (fromCurrency == toCurrency) return amount;

            var rates = await GetExchangeRatesAsync();
            
            if (!rates.ContainsKey(fromCurrency) || !rates.ContainsKey(toCurrency))
                throw new ArgumentException("Unsupported currency");

            // Convert to base currency (AED) first, then to target currency
            var baseAmount = amount / rates[fromCurrency];
            return baseAmount * rates[toCurrency];
        }

        public async Task<Dictionary<string, decimal>> GetExchangeRatesAsync()
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "exchange_rates");

            if (setting != null && !string.IsNullOrEmpty(setting.Value))
            {
                try
                {
                    return JsonSerializer.Deserialize<Dictionary<string, decimal>>(setting.Value) ?? _exchangeRates;
                }
                catch
                {
                    // Fall back to default rates if deserialization fails
                }
            }

            return _exchangeRates;
        }

        public async Task UpdateExchangeRateAsync(string currency, decimal rate)
        {
            var rates = await GetExchangeRatesAsync();
            rates[currency] = rate;

            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "exchange_rates");

            var ratesJson = JsonSerializer.Serialize(rates);

            if (setting == null)
            {
                setting = new Setting
                {
                    Key = "exchange_rates",
                    Value = ratesJson,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(setting);
            }
            else
            {
                setting.Value = ratesJson;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public string FormatCurrency(decimal amount, string? currency = null)
        {
            var defaultCurrency = GetDefaultCurrencyAsync().Result;
            var targetCurrency = currency ?? defaultCurrency;

            return targetCurrency switch
            {
                "AED" => $"{amount:F2} AED",
                "INR" => $"?{amount:F2}",
                "USD" => $"${amount:F2}",
                "EUR" => $"€{amount:F2}",
                _ => $"{amount:F2} {targetCurrency}"
            };
        }
    }
}

