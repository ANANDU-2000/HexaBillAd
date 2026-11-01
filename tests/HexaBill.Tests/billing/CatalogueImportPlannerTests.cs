using System.Linq;
using HexaBill.Api.Modules.Products;
using Xunit;
using static HexaBill.Api.Modules.Products.CatalogueImportPlanner;

namespace HexaBill.Tests.Billing
{
    public class CatalogueImportPlannerTests
    {
        private static SourceProduct Sp(int id, string name, string sku, string unit = "CRTN", bool active = true, string origin = "STARPLUS", string? barcode = null) =>
            new(origin, id, sku, name, null, unit, 1m, barcode, active);

        private static DestinationProduct Dp(int id, string name, string sku, string unit = "CRTN", string? barcode = null) =>
            new(id, sku, name, unit, barcode, true);

        [Fact]
        public void EverySourceRow_GetsExactlyOneDecision()
        {
            var source = new[] { Sp(1, "BEEF SLICE 18KG", "B1"), Sp(2, "beef  slice 18kg", "B2"), Sp(3, "MUTTON LEG", "M1"), Sp(4, "ZZ-TEST item", "T1") };
            var plan = Plan(source, new[] { Dp(10, "Mutton Leg", "GH-1") });
            Assert.Equal(source.Length, plan.Count);
            Assert.Equal(source.Select(s => s.SourceId).OrderBy(x => x), plan.Select(p => p.SourceId).OrderBy(x => x));
        }

        [Fact]
        public void ExistingDestinationProduct_IsNeverOverwrittenOrDuplicated()
        {
            var plan = Plan(new[] { Sp(1, "BEEF SLICE KAMIL 18KG", "BSK") }, new[] { Dp(96, " beef slice kamil 18kg ", "X", unit: "CTN") });
            var row = Assert.Single(plan);
            Assert.Equal("ALREADY_EXISTS", row.Classification);
            Assert.Equal(DecisionSkip, row.Decision);
            Assert.Equal(96, row.MatchedDestinationId);
        }

        [Fact]
        public void SameNameDifferentUnit_InDestination_IsReviewNotImport()
        {
            var row = Assert.Single(Plan(new[] { Sp(1, "CHICKEN WINGS", "CW", unit: "KG") }, new[] { Dp(5, "Chicken Wings", "GH-CW", unit: "CRTN") }));
            Assert.Equal("UNIT_CONFLICT", row.Classification);
            Assert.Equal(DecisionReview, row.Decision);
        }

        [Fact]
        public void SameNameDifferentUnit_InSource_IsReview()
        {
            var plan = Plan(new[] { Sp(1, "LIVER", "L1", unit: "KG"), Sp(2, "LIVER", "L2", unit: "CRTN") }, []);
            Assert.All(plan, r => Assert.Equal("UNIT_CONFLICT", r.Classification));
        }

        [Fact]
        public void OperatingProductWins_OverHistoricalDuplicate()
        {
            var plan = Plan(new[] { Sp(5, "GIZZARD 9KG", "OLD-SKU"), Sp(140, "Gizzard 9kg", "NEW-SKU", origin: "FH1") }, []);
            var import = Assert.Single(plan, r => r.Decision == DecisionImport);
            Assert.Equal("FH1", import.Origin);
            Assert.Equal("NEW-SKU", import.ProposedSku);
            Assert.Equal("DUPLICATE_IN_SOURCE", Assert.Single(plan, r => r.Decision == DecisionSkip).Classification);
        }

        [Fact]
        public void SkuOwnedByDifferentDestinationProduct_IsReview()
        {
            var row = Assert.Single(Plan(new[] { Sp(23, "AL BAB VEAL LEG 18KG", "veal-leg-18kg") }, new[] { Dp(107, "Veal leg 18kg", "VEAL-LEG-18KG") }));
            Assert.Equal("SKU_CONFLICT", row.Classification);
            Assert.Equal(107, row.MatchedDestinationId);
        }

        [Fact]
        public void DuplicateSourceRowWhoseSkuMatchesDestination_FlagsPossibleDuplicate()
        {
            // Live case: Gulf Harvest "CHICKEN 1100 NAT BRAZIL" (CKN-1100-NAT) vs source duplicates of "FROZEN CHICKEN 1100GM NAT".
            var plan = Plan(
                new[] { Sp(60, "FROZEN CHICKEN 1100GM NAT", "FRZN-1100GM-NAT"), Sp(264, "FROZEN CHICKEN 1100GM NAT", "CKN-1100-Nat") },
                new[] { Dp(81, "CHICKEN 1100 NAT BRAZIL", "CKN-1100-NAT") });
            Assert.DoesNotContain(plan, r => r.Decision == DecisionImport);
            var lead = Assert.Single(plan, r => r.SourceId == 60);
            Assert.Equal("POSSIBLE_DUPLICATE", lead.Classification);
            Assert.Equal(81, lead.MatchedDestinationId);
        }

        [Fact]
        public void TwoSourceProductsSharingSku_SecondIsReview()
        {
            var plan = Plan(new[] { Sp(1, "MUTTON CUBE AL WAHA 18KG", "MCA", origin: "FH1"), Sp(272, "MUTTON CUBE AL WAHA", "MCA") }, []);
            Assert.Equal(DecisionImport, Assert.Single(plan, r => r.SourceId == 1).Decision);
            Assert.Equal("SKU_CONFLICT", Assert.Single(plan, r => r.SourceId == 272).Classification);
        }

        [Theory]
        [InlineData("ZZ-TEST gulfharvest-test")]
        [InlineData("E2E Logo Item")]
        [InlineData("Demo chicken")]
        [InlineData("test product")]
        public void TestProducts_AreExcluded(string name)
        {
            var row = Assert.Single(Plan(new[] { Sp(1, name, "T") }, []));
            Assert.Equal("TEST_PRODUCT", row.Classification);
            Assert.Equal(DecisionExclude, row.Decision);
        }

        [Fact]
        public void InactiveSource_IsReview()
        {
            var row = Assert.Single(Plan(new[] { Sp(90, "FrozenHub Onboard Item", "FH-ONBOARD-1", active: false, origin: "FH1") }, []));
            Assert.Equal("INACTIVE_SOURCE", row.Classification);
        }

        [Fact]
        public void BarcodeAlreadyUsed_IsReview()
        {
            var row = Assert.Single(Plan(new[] { Sp(1, "NEW ITEM", "N1", barcode: "629000") }, new[] { Dp(3, "Other", "O1", barcode: "629000") }));
            Assert.Equal("BARCODE_CONFLICT", row.Classification);
        }

        [Fact]
        public void Idempotent_SecondPlanAfterImport_ProposesNothingNew()
        {
            var source = new[] { Sp(1, "BEEF TRIPE", "BT"), Sp(2, "CHICKEN LIVER", "CL") };
            var first = Plan(source, []);
            var imported = first.Where(r => r.Decision == DecisionImport).Select((r, i) => Dp(1000 + i, r.NameEn, r.ProposedSku!, r.UnitType)).ToList();
            Assert.Equal(2, imported.Count);
            var second = Plan(source, imported);
            Assert.DoesNotContain(second, r => r.Decision == DecisionImport);
            Assert.All(second, r => Assert.Equal("ALREADY_EXISTS", r.Classification));
        }

        [Fact]
        public void Csv_RoundTripsQuotesCommasAndNeutralisesFormulas()
        {
            var plan = Plan(new[] { Sp(1, "CHICKEN, \"GRADE A\" 1KG", "=HYPERLINK(1)"), Sp(2, "@SUM", "S2") }, []);
            var csv = ToCsv(plan);
            Assert.DoesNotContain(",=HYPERLINK", csv);
            Assert.DoesNotContain(",@SUM", csv);
            var back = FromCsv(csv);
            Assert.Equal(plan.Select(p => (p.NameEn, p.SourceSku, p.Decision)), back.Select(p => (p.NameEn, p.SourceSku, p.Decision)));
        }

        [Fact]
        public void FromCsv_RejectsUnexpectedHeader()
        {
            Assert.Throws<System.IO.InvalidDataException>(() => FromCsv("Name,Sku\nA,B\n"));
        }

        [Theory]
        [InlineData("PIECE", "PCS")]
        [InlineData("pc", "PCS")]
        [InlineData("CTN", "CRTN")]
        [InlineData("Kgs", "KG")]
        public void UnitSynonyms_CompareEqual(string unit, string expected) => Assert.Equal(expected, NormalizeUnit(unit));
    }
}
