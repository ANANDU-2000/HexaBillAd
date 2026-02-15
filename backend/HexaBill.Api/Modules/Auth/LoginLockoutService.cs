namespace HexaBill.Api.Modules.Auth;

public interface ILoginLockoutService
{
    bool IsLockedOut(string email);
    void RecordFailedAttempt(string email);
    void ClearAttempts(string email);
}

public class LoginLockoutService : ILoginLockoutService
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, List<DateTime>> _attempts = new();

    public bool IsLockedOut(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return false;
        Prune(key);
        return _attempts.TryGetValue(key, out var list) && list.Count >= MaxAttempts;
    }

    public void RecordFailedAttempt(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return;
        var list = _attempts.AddOrUpdate(key, _ => new List<DateTime> { DateTime.UtcNow }, (_, existing) =>
        {
            existing.Add(DateTime.UtcNow);
            return existing;
        });
        Prune(key);
    }

    public void ClearAttempts(string email)
    {
        var key = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return;
        _attempts.TryRemove(key, out _);
    }

    private static void Prune(string key)
    {
        if (!_attempts.TryGetValue(key, out var list)) return;
        var cutoff = DateTime.UtcNow - LockoutWindow;
        list.RemoveAll(d => d < cutoff);
        if (list.Count == 0) _attempts.TryRemove(key, out _);
    }
}
