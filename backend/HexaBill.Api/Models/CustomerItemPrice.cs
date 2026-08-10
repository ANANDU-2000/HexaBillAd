/*
Purpose: Per-customer last billed exclusive unit price for a product (POS prefill memory).
*/
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HexaBill.Api.Models
{
    public class CustomerItemPrice
    {
        public int Id { get; set; }

        public int TenantId { get; set; }

        public int CustomerId { get; set; }

        public int ProductId { get; set; }

        /// <summary>VAT-exclusive unit price (mirrors SaleItem.UnitPrice).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal LastUnitPrice { get; set; }

        public int? LastSaleId { get; set; }

        public DateTime LastSaleDate { get; set; }

        public DateTime UpdatedAt { get; set; }

        public virtual Customer? Customer { get; set; }
        public virtual Product? Product { get; set; }
        public virtual Sale? LastSale { get; set; }
    }
}
