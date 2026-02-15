/*
Purpose: Backup manifest model for schema versioning and metadata
Author: AI Assistant
Date: 2024
*/
using System.Text.Json.Serialization;

namespace HexaBill.Api.Models
{
    public class BackupManifest
    {
        [JsonPropertyName("schemaVersion")]
        public string SchemaVersion { get; set; } = "1.0";
        
        [JsonPropertyName("backupDate")]
        public DateTime BackupDate { get; set; }
        
        [JsonPropertyName("appVersion")]
        public string AppVersion { get; set; } = "1.0.0";
        
        [JsonPropertyName("databaseType")]
        public string DatabaseType { get; set; } = "SQLite";
        
        [JsonPropertyName("recordCounts")]
        public RecordCounts RecordCounts { get; set; } = new();
        
        [JsonPropertyName("checksums")]
        public Dictionary<string, string> Checksums { get; set; } = new();
        
        [JsonPropertyName("exportedBy")]
        public string ExportedBy { get; set; } = "";
        
        [JsonPropertyName("notes")]
        public string? Notes { get; set; }
    }

    public class RecordCounts
    {
        [JsonPropertyName("products")]
        public int Products { get; set; }
        
        [JsonPropertyName("customers")]
        public int Customers { get; set; }
        
        [JsonPropertyName("sales")]
        public int Sales { get; set; }
        
        [JsonPropertyName("purchases")]
        public int Purchases { get; set; }
        
        [JsonPropertyName("payments")]
        public int Payments { get; set; }
        
        [JsonPropertyName("expenses")]
        public int Expenses { get; set; }
        
        [JsonPropertyName("users")]
        public int Users { get; set; }
    }

    public class ImportConflict
    {
        public string EntityType { get; set; } = ""; // "Product", "Customer", "Sale", etc.
        public int? ExistingId { get; set; }
        public int? ImportedId { get; set; }
        public string ExistingData { get; set; } = "";
        public string ImportedData { get; set; } = "";
        public ConflictType Type { get; set; }
        public string? Resolution { get; set; } // "merge", "skip", "overwrite", "create_new"
    }

    public enum ConflictType
    {
        DuplicateId,      // Same ID exists
        DuplicateUnique, // Same unique field (SKU, InvoiceNo, etc.)
        SchemaMismatch,   // Schema version incompatible
        DataConflict      // Data differs for same entity
    }

    public class ImportPreview
    {
        public BackupManifest Manifest { get; set; } = new();
        public List<ImportConflict> Conflicts { get; set; } = new();
        public bool IsCompatible { get; set; }
        public string? CompatibilityMessage { get; set; }
        public Dictionary<string, int> ImportCounts { get; set; } = new();
    }

    public class ImportResult
    {
        public bool Success { get; set; }
        public int Imported { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
        public int Errors { get; set; }
        public List<string> ErrorMessages { get; set; } = new();
        public Dictionary<string, int> EntityCounts { get; set; } = new();
        public Dictionary<int, int> IdMappings { get; set; } = new(); // Old ID -> New ID
    }
}

