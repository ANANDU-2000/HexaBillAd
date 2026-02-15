/*
Purpose: Automatic product seeding from Excel files on startup
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Inventory
{
    public interface IProductSeedService
    {
        Task SeedProductsFromExcelAsync();
    }

    public class ProductSeedService : IProductSeedService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ProductSeedService> _logger;

        public ProductSeedService(
            IServiceProvider serviceProvider,
            ILogger<ProductSeedService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task SeedProductsFromExcelAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var excelImportService = scope.ServiceProvider.GetRequiredService<IExcelImportService>();

            try
            {
                // Check if products already exist
                var existingProductCount = await context.Products.CountAsync();
                
                // If we have more than 20 products, assume already seeded
                if (existingProductCount > 20)
                {
                    _logger.LogInformation($"Products already seeded. Found {existingProductCount} products in database.");
                    return;
                }

                _logger.LogInformation($"Starting product seed from Excel files. Current product count: {existingProductCount}");

                // Get system user (admin) for import
                var systemUser = await context.Users
                    .FirstOrDefaultAsync(u => u.Role == UserRole.Admin);
                
                if (systemUser == null)
                {
                    _logger.LogWarning("No admin user found. Cannot seed products.");
                    return;
                }

                var excelFiles = new[]
                {
                    "PRICE LIST - 08.04.2025.xlsx",
                    "PRODUCT LINE.xlsx"
                };

                var baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
                var currentDirectory = Directory.GetCurrentDirectory();
                
                // Try multiple paths to find Excel files (root directory, current directory, parent directories)
                var searchPaths = new List<string>();
                
                // Seed data directory inside published output (via csproj CopyToOutput)
                var seedDataDirectory = Path.Combine(baseDirectory, "SeedData");
                if (Directory.Exists(seedDataDirectory))
                {
                    searchPaths.Add(seedDataDirectory);
                }
                
                // Project root (4 levels up from bin/Debug/net9.0)
                var projectRoot = Path.GetFullPath(Path.Combine(baseDirectory, "..", "..", "..", ".."));
                searchPaths.Add(projectRoot);
                
                // Also try 3 levels up (in case structure is different)
                var projectRoot3 = Path.GetFullPath(Path.Combine(baseDirectory, "..", "..", ".."));
                searchPaths.Add(projectRoot3);
                
                // Current working directory
                searchPaths.Add(currentDirectory);
                
                // Parent of current directory (project root if running from backend/HexaBill.Api)
                var parentDir = Directory.GetParent(currentDirectory)?.FullName;
                if (parentDir != null) 
                {
                    searchPaths.Add(parentDir);
                    // Also try parent of parent (actual project root)
                    var grandParentDir = Directory.GetParent(parentDir)?.FullName;
                    if (grandParentDir != null) searchPaths.Add(grandParentDir);
                }
                
                // Base directory
                searchPaths.Add(baseDirectory);
                
                // Try to find the actual project root by looking for README.md or Excel files
                var possibleRoots = new[] { projectRoot, projectRoot3, currentDirectory, parentDir, seedDataDirectory };
                foreach (var root in possibleRoots)
                {
                    if (root != null && File.Exists(Path.Combine(root, "README.md")))
                    {
                        searchPaths.Insert(0, root); // Add to front of list
                        break;
                    }
                }

                int totalImported = 0;
                int totalUpdated = 0;

                foreach (var excelFile in excelFiles)
                {
                    string? filePath = null;
                    
                    // Search in all possible directories
                    foreach (var searchPath in searchPaths)
                    {
                        var testPath = Path.Combine(searchPath, excelFile);
                        if (File.Exists(testPath))
                        {
                            filePath = testPath;
                            break;
                        }
                    }

                    if (filePath == null)
                    {
                        _logger.LogWarning($"Excel file not found: {excelFile}. Searched in: {string.Join(", ", searchPaths)}");
                        continue;
                    }

                    try
                    {
                        _logger.LogInformation($"Importing products from: {excelFile} (found at: {filePath})");

                        using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                        var result = await excelImportService.ImportProductsFromExcelAsync(
                            fileStream, 
                            excelFile, 
                            systemUser.Id);

                        totalImported += result.Imported;
                        totalUpdated += result.Updated;

                        _logger.LogInformation(
                            $"Import from {excelFile} completed: " +
                            $"{result.Imported} new, {result.Updated} updated, " +
                            $"{result.Skipped} skipped, {result.Errors} errors");

                        if (result.ErrorMessages.Any())
                        {
                            foreach (var error in result.ErrorMessages.Take(10))
                            {
                                _logger.LogWarning($"Import error: {error}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log one short line only - avoid stack traces on startup (Excel often fails on corrupt/custom formats)
                        _logger.LogWarning("Skipped {File}: could not read Excel ({Message}). Add products manually if needed.", excelFile, ex.Message);
                    }
                }

                var finalCount = await context.Products.CountAsync();
                _logger.LogInformation(
                    "Product seeding completed. Total products in database: {Count} ({Imported} imported, {Updated} updated from Excel).",
                    finalCount, totalImported, totalUpdated);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Product seed from Excel skipped: {Message}. App will start normally.", ex.Message);
            }
        }
    }
}
