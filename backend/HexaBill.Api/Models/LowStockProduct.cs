using System;

namespace HexaBill.Api.Models
{
    public class LowStockProduct
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal StockQty { get; set; }
        public string UnitType { get; set; } = string.Empty;
    }
}
