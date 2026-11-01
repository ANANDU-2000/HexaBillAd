const fs = require('fs');

// 1. Add LegacyProduct to LegacyEntities.cs
const entityFile = 'backend/HexaBill.Api/Models/Legacy/LegacyEntities.cs';
let entityContent = fs.readFileSync(entityFile, 'utf8');

const legacyProductEntity = `
    [Table("LegacyProducts")]
    public class LegacyProduct
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceProductId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public string Sku { get; set; } = string.Empty;
        public string NameEn { get; set; } = string.Empty;
        public string? NameAr { get; set; }
        public string UnitType { get; set; } = "PCS";
        public decimal ConversionToBase { get; set; } = 1;
        public decimal CostPrice { get; set; }
        public decimal SellPrice { get; set; }
        public decimal StockQtyLegacy { get; set; }
        public string? Barcode { get; set; }
        public int? DestinationProductId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
`;

const lastBraceIndex = entityContent.lastIndexOf('}');
if (lastBraceIndex !== -1) {
    entityContent = entityContent.slice(0, lastBraceIndex) + legacyProductEntity;
    fs.writeFileSync(entityFile, entityContent, 'utf8');
    console.log('Appended LegacyProduct to LegacyEntities.cs');
}

// 2. Add DbSet<LegacyProduct> to AppDbContext.cs
const dbContextFile = 'backend/HexaBill.Api/Data/AppDbContext.cs';
let dbContent = fs.readFileSync(dbContextFile, 'utf8');

const targetLine = 'public DbSet<LegacyCustomer> LegacyCustomers { get; set; }';
const newLine = 'public DbSet<LegacyProduct> LegacyProducts { get; set; }\n        ' + targetLine;

if (dbContent.includes(targetLine) && !dbContent.includes('DbSet<LegacyProduct>')) {
    dbContent = dbContent.replace(targetLine, newLine);
    fs.writeFileSync(dbContextFile, dbContent, 'utf8');
    console.log('Added DbSet<LegacyProduct> to AppDbContext.cs');
} else {
    console.log('DbSet<LegacyProduct> already exists or target not found');
}

