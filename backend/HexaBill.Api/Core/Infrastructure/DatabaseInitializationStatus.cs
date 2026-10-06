namespace HexaBill.Api.Core.Infrastructure;

public enum DatabaseInitializationState
{
    Pending = 0,
    Ready = 1,
    Failed = 2
}

/// <summary>Process-local state for the asynchronous database initialization lifecycle.</summary>
public sealed class DatabaseInitializationStatus
{
    private int _state = (int)DatabaseInitializationState.Pending;

    public DatabaseInitializationState State => (DatabaseInitializationState)Volatile.Read(ref _state);

    public void MarkFailed() => Interlocked.Exchange(ref _state, (int)DatabaseInitializationState.Failed);

    internal void SetStateForTests(DatabaseInitializationState state) => Interlocked.Exchange(ref _state, (int)state);

    public void CompleteInitialization(bool hasPendingMigrations)
    {
        if (hasPendingMigrations)
        {
            MarkFailed();
            return;
        }

        // A later success must not erase an earlier required-schema failure.
        Interlocked.CompareExchange(ref _state, (int)DatabaseInitializationState.Ready, (int)DatabaseInitializationState.Pending);
    }
}
