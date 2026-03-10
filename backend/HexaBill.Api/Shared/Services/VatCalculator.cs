/*
Purpose: Pure VAT calculation for UAE FTA - no DI, no DB. Per-line rounding.
Author: HexaBill
Date: 2026
*/
using System;
using System.Globalization;

namespace HexaBill.Api.Shared.Services
{
    /// <summary>VAT scenario for supplies (FTA).</summary>
    public static class VatScenarios
    {
        public const string Standard = "Standard";
        public const string ZeroRated = "ZeroRated";
        public const string Exempt = "Exempt";
        public const string OutOfScope = "OutOfScope";
        public const string ReverseCharge = "ReverseCharge";
        public const string DesignatedZone = "DesignatedZone";
    }

    /// <summary>Tax type for expenses (Standard, Petroleum, Exempt).</summary>
    public static class TaxTypes
    {
        public const string Standard = "Standard";
        public const string Petroleum = "Petroleum";
        public const string Excise = "Excise";
        public const string Exempt = "Exempt";
    }

    /// <summary>Result of a single VAT calculation (per line).</summary>
    public class VatCalculationResult
    {
        public decimal NetAmount { get; set; }
        public decimal VatRate { get; set; }
        public decimal VatAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal ClaimableVat { get; set; }
        public decimal ReverseChargeVat { get; set; }
        public string Scenario { get; set; } = string.Empty;
    }

    /// <summary>Pure VAT calculator: UAE 5% standard; zero-rated/exempt/out-of-scope/petroleum = 0; entertainment 50% cap; partial credit.</summary>
    public static class VatCalculator
    {
        public const decimal StandardRate = 0.05m;
        private const int DecimalPlaces = 2;
        private static readonly MidpointRounding Rounding = MidpointRounding.AwayFromZero;

        /// <summary>Round amount to 2 dp (for VAT and money).</summary>
        public static decimal Round(decimal value)
        {
            return Math.Round(value, DecimalPlaces, Rounding);
        }

        /// <summary>Calculate VAT for a supply (sale) line. Uses VatScenario; ZeroRated/Exempt/OutOfScope/Petroleum/DesignatedZone = 0.</summary>
        public static VatCalculationResult ForSupply(
            decimal netAmount,
            string? vatScenario,
            bool isReverseCharge = false)
        {
            var scenario = NormalizeScenario(vatScenario);
            if (isReverseCharge || scenario == VatScenarios.ReverseCharge)
            {
                // Reverse charge: output VAT same as would be claimable; we report base in Box 4 and VAT in Box 10
                return new VatCalculationResult
                {
                    NetAmount = Round(netAmount),
                    VatRate = StandardRate,
                    VatAmount = Round(netAmount * StandardRate),
                    TotalAmount = Round(netAmount + Round(netAmount * StandardRate)),
                    ClaimableVat = 0,
                    ReverseChargeVat = Round(netAmount * StandardRate),
                    Scenario = VatScenarios.ReverseCharge
                };
            }
            if (scenario == VatScenarios.Standard)
            {
                var vat = Round(netAmount * StandardRate);
                return new VatCalculationResult
                {
                    NetAmount = Round(netAmount),
                    VatRate = StandardRate,
                    VatAmount = vat,
                    TotalAmount = Round(netAmount + vat),
                    ClaimableVat = 0,
                    ReverseChargeVat = 0,
                    Scenario = VatScenarios.Standard
                };
            }
            // ZeroRated, Exempt, OutOfScope, DesignatedZone, or null/empty
            return new VatCalculationResult
            {
                NetAmount = Round(netAmount),
                VatRate = 0,
                VatAmount = 0,
                TotalAmount = Round(netAmount),
                ClaimableVat = 0,
                ReverseChargeVat = 0,
                Scenario = scenario ?? VatScenarios.ZeroRated
            };
        }

        /// <summary>Calculate VAT for an expense line. Petroleum/Exempt = 0 claimable; entertainment 50% cap; partialCreditPct applied.</summary>
        public static VatCalculationResult ForExpense(
            decimal netAmount,
            string? taxType,
            bool isTaxClaimable,
            bool isEntertainment,
            decimal partialCreditPct = 100m)
        {
            var normalized = (taxType ?? string.Empty).Trim();
            if (string.Equals(normalized, TaxTypes.Petroleum, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(normalized, TaxTypes.Exempt, StringComparison.OrdinalIgnoreCase))
            {
                return new VatCalculationResult
                {
                    NetAmount = Round(netAmount),
                    VatRate = 0,
                    VatAmount = 0,
                    TotalAmount = Round(netAmount),
                    ClaimableVat = 0,
                    ReverseChargeVat = 0,
                    Scenario = normalized
                };
            }
            // Standard (or empty): 5% VAT
            var vatAmount = Round(netAmount * StandardRate);
            var totalAmount = Round(netAmount + vatAmount);
            var claimable = isTaxClaimable ? vatAmount : 0m;
            claimable = Round(claimable * (partialCreditPct / 100m));
            if (isEntertainment)
                claimable = Round(claimable * 0.5m); // 50% cap
            return new VatCalculationResult
            {
                NetAmount = Round(netAmount),
                VatRate = StandardRate,
                VatAmount = vatAmount,
                TotalAmount = totalAmount,
                ClaimableVat = claimable,
                ReverseChargeVat = 0,
                Scenario = TaxTypes.Standard
            };
        }

        /// <summary>Reverse charge purchase: base in Box 4, claimable VAT in Box 10.</summary>
        public static VatCalculationResult ForReverseChargePurchase(decimal netAmount, bool isTaxClaimable)
        {
            var vat = Round(netAmount * StandardRate);
            return new VatCalculationResult
            {
                NetAmount = Round(netAmount),
                VatRate = StandardRate,
                VatAmount = vat,
                TotalAmount = Round(netAmount + vat),
                ClaimableVat = isTaxClaimable ? vat : 0,
                ReverseChargeVat = isTaxClaimable ? vat : 0,
                Scenario = VatScenarios.ReverseCharge
            };
        }

        private static string? NormalizeScenario(string? scenario)
        {
            if (string.IsNullOrWhiteSpace(scenario)) return null;
            var s = scenario.Trim();
            if (string.Equals(s, VatScenarios.Standard, StringComparison.OrdinalIgnoreCase)) return VatScenarios.Standard;
            if (string.Equals(s, VatScenarios.ZeroRated, StringComparison.OrdinalIgnoreCase)) return VatScenarios.ZeroRated;
            if (string.Equals(s, VatScenarios.Exempt, StringComparison.OrdinalIgnoreCase)) return VatScenarios.Exempt;
            if (string.Equals(s, VatScenarios.OutOfScope, StringComparison.OrdinalIgnoreCase)) return VatScenarios.OutOfScope;
            if (string.Equals(s, VatScenarios.ReverseCharge, StringComparison.OrdinalIgnoreCase)) return VatScenarios.ReverseCharge;
            if (string.Equals(s, VatScenarios.DesignatedZone, StringComparison.OrdinalIgnoreCase)) return VatScenarios.DesignatedZone;
            return s;
        }
    }
}
