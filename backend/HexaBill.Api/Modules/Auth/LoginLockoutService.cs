using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Auth;

public interface ILoginLockoutService
{
    Task<bool> IsLockedOutAsync(string email);
    Task RecordFailedAttemptAsync(string email);
    Task ClearAttemptsAsync(string email);
    /// <summary>Manually lock a user for specified duration (Super Admin only).</summary>
    Task LockUserAsync(string email, int durationMinutes = 15);
}

/// <summary>
/// BUG #2.7 FIX: Persistent login lockout service - stores attempts in PostgreSQL instead of memory
/// Survives server restarts, prevents brute force attacks across deployments
/// </summary>
public class LoginLockoutService : ILoginLockoutService
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);
    private readonly AppDbContext _context;

    public LoginLockoutService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> IsLockedOutAsync(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return false;

        // Clean up old attempts first
        await PruneOldAttemptsAsync();

        var attempt = await _context.FailedLoginAttempts
            .FirstOrDefaultAsync(a => a.Email == key);

        if (attempt == null) return false;

        // Check if locked out and lockout hasn't expired
        if (attempt.LockoutUntil.HasValue && attempt.LockoutUntil.Value > DateTime.UtcNow)
        {
            return true;
        }

        // Check if failed count exceeds max attempts within lockout window
        if (attempt.FailedCount >= MaxAttempts && 
            attempt.LastAttemptAt > DateTime.UtcNow - LockoutWindow)
        {
            // Set lockout until time if not already set
            if (!attempt.LockoutUntil.HasValue)
            {
                attempt.LockoutUntil = DateTime.UtcNow.Add(LockoutWindow);
                attempt.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            return true;
        }

        return false;
    }

    public async Task RecordFailedAttemptAsync(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return;

        await PruneOldAttemptsAsync();

        var attempt = await _context.FailedLoginAttempts
            .FirstOrDefaultAsync(a => a.Email == key);

        if (attempt == null)
        {
            // Create new failed attempt record
            attempt = new FailedLoginAttempt
            {
                Email = key,
                FailedCount = 1,
                LastAttemptAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            _context.FailedLoginAttempts.Add(attempt);
        }
        else
        {
            // Increment failed count
            attempt.FailedCount++;
            attempt.LastAttemptAt = DateTime.UtcNow;
            attempt.UpdatedAt = DateTime.UtcNow;

            // Set lockout if max attempts reached
            if (attempt.FailedCount >= MaxAttempts)
            {
                attempt.LockoutUntil = DateTime.UtcNow.Add(LockoutWindow);
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task ClearAttemptsAsync(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return;

        var attempt = await _context.FailedLoginAttempts
            .FirstOrDefaultAsync(a => a.Email == key);

        if (attempt != null)
        {
            _context.FailedLoginAttempts.Remove(attempt);
            await _context.SaveChangesAsync();
        }
    }

    public async Task LockUserAsync(string email, int durationMinutes = 15)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return;

        var attempt = await _context.FailedLoginAttempts
            .FirstOrDefaultAsync(a => a.Email == key);

        if (attempt == null)
        {
            attempt = new FailedLoginAttempt
            {
                Email = key,
                FailedCount = MaxAttempts,
                LastAttemptAt = DateTime.UtcNow,
                LockoutUntil = DateTime.UtcNow.AddMinutes(Math.Max(1, durationMinutes)),
                CreatedAt = DateTime.UtcNow
            };
            _context.FailedLoginAttempts.Add(attempt);
        }
        else
        {
            attempt.FailedCount = MaxAttempts;
            attempt.LockoutUntil = DateTime.UtcNow.AddMinutes(Math.Max(1, durationMinutes));
            attempt.UpdatedAt = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
    }

    private async Task PruneOldAttemptsAsync()
    {
        // Remove attempts older than lockout window that are not locked out
        var cutoff = DateTime.UtcNow - LockoutWindow;
        var oldAttempts = await _context.FailedLoginAttempts
            .Where(a => a.LastAttemptAt < cutoff && 
                       (!a.LockoutUntil.HasValue || a.LockoutUntil.Value < DateTime.UtcNow))
            .ToListAsync();

        if (oldAttempts.Any())
        {
            _context.FailedLoginAttempts.RemoveRange(oldAttempts);
            await _context.SaveChangesAsync();
        }
    }
}
