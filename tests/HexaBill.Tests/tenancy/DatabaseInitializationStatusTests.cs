using HexaBill.Api.Core.Infrastructure;

namespace HexaBill.Tests;

public sealed class DatabaseInitializationStatusTests
{
    [Fact]
    public void CompleteInitialization_WithNoPendingMigrations_MarksReady()
    {
        var status = new DatabaseInitializationStatus();

        status.CompleteInitialization(hasPendingMigrations: false);

        Assert.Equal(DatabaseInitializationState.Ready, status.State);
    }

    [Fact]
    public void CompleteInitialization_WithPendingMigrations_MarksFailed()
    {
        var status = new DatabaseInitializationStatus();

        status.CompleteInitialization(hasPendingMigrations: true);

        Assert.Equal(DatabaseInitializationState.Failed, status.State);
    }

    [Fact]
    public void LaterSuccessfulCompletion_DoesNotClearEarlierFailure()
    {
        var status = new DatabaseInitializationStatus();
        status.MarkFailed();

        status.CompleteInitialization(hasPendingMigrations: false);

        Assert.Equal(DatabaseInitializationState.Failed, status.State);
    }
}
