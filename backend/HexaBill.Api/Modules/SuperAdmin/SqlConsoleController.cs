/*
 * Read-only SQL console for Super Admin. PRODUCTION_MASTER_TODO #47.
 * Execute SELECT only; timeout and row limit enforced.
 */
using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/superadmin")]
    [Authorize(Roles = "SystemAdmin")]
    public class SqlConsoleController : ControllerBase
    {
        // BUG #2.3 FIX: Reduce max rows to 500 for better performance and security
        private const int MaxRows = 500;
        private const int CommandTimeoutSeconds = 30;

        private static readonly Regex CommentBlockRegex = new Regex(@"/\*[\s\S]*?\*/", RegexOptions.Multiline);
        // BUG #2.3 FIX: Enhanced blacklist - catch DELETE/UPDATE/TRUNCATE without WHERE clause
        private static readonly Regex ForbiddenKeywordRegex = new Regex(
            @"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|CALL|REFRESH|LOCK|COPY|VACUUM)\b",
            RegexOptions.IgnoreCase);
        // BUG #2.3 FIX: Detect DELETE/UPDATE without WHERE clause (dangerous even if keyword is allowed)
        private static readonly Regex DangerousDeleteUpdateRegex = new Regex(
            @"\b(DELETE|UPDATE|TRUNCATE)\s+[^\s]+\s*(?!WHERE)",
            RegexOptions.IgnoreCase);

        private readonly AppDbContext _db;

        public SqlConsoleController(AppDbContext db)
        {
            _db = db;
        }

        /// <summary>
        /// Execute a read-only SQL query (SELECT only). Timeout 30s, max 1000 rows. SystemAdmin only.
        /// </summary>
        [HttpPost("sql-console")]
        public async Task<ActionResult<ApiResponse<SqlConsoleResultDto>>> ExecuteQuery([FromBody] SqlConsoleRequest request)
        {
            if (request?.Query == null)
                return BadRequest(new ApiResponse<SqlConsoleResultDto> { Success = false, Message = "Query is required." });

            var query = request.Query.Trim();
            if (query.Length == 0)
                return BadRequest(new ApiResponse<SqlConsoleResultDto> { Success = false, Message = "Query cannot be empty." });

            if (query.Length > 50_000)
                return BadRequest(new ApiResponse<SqlConsoleResultDto> { Success = false, Message = "Query too long." });

            var (valid, error) = ValidateReadOnly(query);
            if (!valid)
                return BadRequest(new ApiResponse<SqlConsoleResultDto> { Success = false, Message = error });

            // BUG #2.3 FIX: Get admin user ID for AuditLog
            var adminUserId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : 0;

            if (!_db.Database.IsNpgsql())
                return BadRequest(new ApiResponse<SqlConsoleResultDto> { Success = false, Message = "SQL console is only supported for PostgreSQL." });

            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var connection = _db.Database.GetDbConnection();
                await connection.OpenAsync();

                using var transaction = await connection.BeginTransactionAsync();
                try
                {
                    // PostgreSQL: read-only transaction (must be first statement)
                    using (var setReadOnlyCmd = connection.CreateCommand())
                    {
                        setReadOnlyCmd.Transaction = transaction;
                        setReadOnlyCmd.CommandText = "SET TRANSACTION READ ONLY";
                        setReadOnlyCmd.CommandTimeout = 5;
                        await setReadOnlyCmd.ExecuteNonQueryAsync();
                    }

                    var columns = new List<string>();
                    var rows = new List<Dictionary<string, object?>>();
                    var truncated = false;

                    using (var command = connection.CreateCommand())
                    {
                        command.Transaction = transaction;
                        command.CommandText = query.TrimEnd().TrimEnd(';').Trim();
                        command.CommandTimeout = CommandTimeoutSeconds;

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        for (var i = 0; i < reader.FieldCount; i++)
                            columns.Add(reader.GetName(i));

                        var count = 0;
                        while (await reader.ReadAsync() && count < MaxRows)
                        {
                            var row = new Dictionary<string, object?>();
                            for (var i = 0; i < reader.FieldCount; i++)
                            {
                                var name = reader.GetName(i);
                                var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                                if (value is DateTime dt)
                                    row[name] = dt.ToString("O");
                                else
                                    row[name] = value;
                            }
                            rows.Add(row);
                            count++;
                        }
                        if (await reader.ReadAsync())
                            truncated = true;
                    }

                    await transaction.CommitAsync();
                    }
                    sw.Stop();

                    // BUG #2.3 FIX: Log every SQL query execution to AuditLog for security auditing
                    try
                    {
                        var auditLog = new AuditLog
                        {
                            OwnerId = 0, // SystemAdmin operations
                            TenantId = 0, // SystemAdmin operations
                            UserId = adminUserId,
                            Action = "SQL Console Query",
                            Details = $"Executed SQL query: {query.Substring(0, Math.Min(200, query.Length))}... (Rows: {rows.Count}, Time: {sw.ElapsedMilliseconds}ms)",
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.AuditLogs.Add(auditLog);
                        await _db.SaveChangesAsync();
                    }
                    catch
                    {
                        // Don't fail the query if audit logging fails
                    }

                    return Ok(new ApiResponse<SqlConsoleResultDto>
                    {
                        Success = true,
                        Message = truncated ? $"Results truncated to {MaxRows} rows. Query executed successfully." : "Query executed successfully.",
                        Data = new SqlConsoleResultDto
                        {
                            Columns = columns,
                            Rows = rows,
                            RowCount = rows.Count,
                            ExecutionMs = sw.ElapsedMilliseconds,
                            Truncated = truncated
                        }
                    });
                }
                finally
                {
                    if (connection.State == ConnectionState.Open)
                        await connection.CloseAsync();
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                return Ok(new ApiResponse<SqlConsoleResultDto>
                {
                    Success = false,
                    Message = ex.Message,
                    Data = new SqlConsoleResultDto
                    {
                        Columns = new List<string>(),
                        Rows = new List<Dictionary<string, object?>>(),
                        RowCount = 0,
                        ExecutionMs = sw.ElapsedMilliseconds,
                        Truncated = false
                    }
                });
            }
        }

        private static (bool valid, string? error) ValidateReadOnly(string query)
        {
            var normalized = query;
            normalized = CommentBlockRegex.Replace(normalized, " ");
            normalized = Regex.Replace(normalized, @"--[^\r\n]*", " ");
            normalized = Regex.Replace(normalized, @"\s+", " ").Trim();

            if (string.IsNullOrWhiteSpace(normalized))
                return (false, "Query is empty after removing comments.");

            var firstStatement = normalized.Split(';')[0].Trim();
            if (string.IsNullOrWhiteSpace(firstStatement))
                return (false, "Only one statement is allowed.");

            var firstWord = Regex.Match(firstStatement, @"^\s*(\w+)", RegexOptions.IgnoreCase);
            if (!firstWord.Success || !string.Equals(firstWord.Groups[1].Value, "SELECT", StringComparison.OrdinalIgnoreCase))
                return (false, "Only SELECT statements are allowed.");

            if (ForbiddenKeywordRegex.IsMatch(normalized))
                return (false, "Query must not contain INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, or other write/DDL keywords.");

            // BUG #2.3 FIX: Detect DELETE/UPDATE without WHERE clause (dangerous even if keyword is allowed)
            if (DangerousDeleteUpdateRegex.IsMatch(normalized))
                return (false, "DELETE/UPDATE/TRUNCATE statements without WHERE clause are not allowed for safety.");

            var semiIdx = normalized.IndexOf(';');
            if (semiIdx >= 0 && normalized.Substring(semiIdx).TrimEnd() != ";")
                return (false, "Multiple statements are not allowed.");

            return (true, null);
        }
    }

    public class SqlConsoleRequest
    {
        public string Query { get; set; } = string.Empty;
    }

    public class SqlConsoleResultDto
    {
        public List<string> Columns { get; set; } = new();
        public List<Dictionary<string, object?>> Rows { get; set; } = new();
        public int RowCount { get; set; }
        public long ExecutionMs { get; set; }
        public bool Truncated { get; set; }
    }
}
