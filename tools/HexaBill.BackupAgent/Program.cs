using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace HexaBill.BackupAgent;

internal static class Program
{
    private const string Version = "1.0.0";
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private static async Task<int> Main(string[] args)
    {
        var command = args.Length == 0 ? "run" : args[0].Trim().ToLowerInvariant();
        try
        {
            return command switch
            {
                "pair" => await PairAsync(args),
                "run" => await RunAsync(),
                "folder" => ChooseFolderInteractive(),
                "install" => InstallLogonTask(),
                _ => Help()
            };
        }
        catch (Exception)
        {
            Console.Error.WriteLine("Backup could not be completed.");
            return 1;
        }
    }

    private static int Help()
    {
        Console.WriteLine("HexaBill Backup Agent");
        Console.WriteLine("  pair     Connect this PC with a code from Backup settings");
        Console.WriteLine("  run      Check the schedule and save backups");
        Console.WriteLine("  folder   Choose the backup folder");
        Console.WriteLine("  install  Start the agent when you sign in to Windows");
        return 0;
    }

    private static async Task<int> PairAsync(string[] args)
    {
        var api = Arg(args, "--api") ?? Prompt("HexaBill address (the site you use to sign in)");
        var code = Arg(args, "--code") ?? Prompt("Pairing code");
        var name = Arg(args, "--name") ?? Prompt("Name for this PC", Environment.MachineName);
        if (string.IsNullOrWhiteSpace(api) || string.IsNullOrWhiteSpace(code))
        {
            Console.Error.WriteLine("Address and pairing code are required.");
            return 1;
        }

        var folder = ChooseFolder();
        if (string.IsNullOrWhiteSpace(folder))
        {
            Console.Error.WriteLine("Backup folder is unavailable.");
            return 1;
        }

        using var http = CreateClient(api);
        var response = await http.PostAsJsonAsync("/api/backup/agent/pair", new { code, displayName = name });
        var body = await response.Content.ReadFromJsonAsync<Envelope<PairResult>>(Json);
        if (!response.IsSuccessStatusCode || body?.Data?.Token == null)
        {
            Console.Error.WriteLine(body?.Message ?? "That pairing code is not valid.");
            return 1;
        }

        Store.Save(new AgentConfig { ApiBase = NormalizeApi(api), DeviceName = name, FolderPath = folder }, body.Data.Token);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.Data.Token);
        await HeartbeatAsync(http, folder);
        Console.WriteLine("This PC is connected.");
        Console.WriteLine("Backup folder: " + Path.GetFileName(folder));
        return 0;
    }

    private static async Task<int> RunAsync()
    {
        var config = Store.Load();
        var token = Store.LoadToken();
        if (config == null || string.IsNullOrWhiteSpace(token))
        {
            Console.Error.WriteLine("This PC is not connected. Run: HexaBill.BackupAgent pair");
            return 1;
        }
        if (string.IsNullOrWhiteSpace(config.FolderPath) || !Directory.Exists(config.FolderPath))
        {
            Console.Error.WriteLine("Backup folder is unavailable.");
            return 1;
        }

        using var http = CreateClient(config.ApiBase, token);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            await HeartbeatAsync(http, config.FolderPath);
            await TryBackupAsync(http, config);
        }
        while (await timer.WaitForNextTickAsync());
        return 0;
    }

    private static async Task TryBackupAsync(HttpClient http, AgentConfig config)
    {
        Envelope<JobResult>? job = null;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                var response = await http.PostAsync("/api/backup/agent/jobs/claim", content: null);
                if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
                    throw new HttpRequestException("server");
                job = await response.Content.ReadFromJsonAsync<Envelope<JobResult>>(Json);
                break;
            }
            catch (HttpRequestException)
            {
                if (attempt == 2)
                {
                    Console.Error.WriteLine("Unable to reach HexaBill.");
                    return;
                }
                await Task.Delay(TimeSpan.FromSeconds(attempt == 0 ? 15 : attempt == 1 ? 45 : 120));
            }
        }

        if (job?.Data is not { Due: true, RunId: > 0 } data || string.IsNullOrWhiteSpace(data.Sha256))
        {
            if (!string.IsNullOrWhiteSpace(job?.Data?.Message))
                Console.WriteLine(job.Data.Message);
            return;
        }

        var downloadName = string.IsNullOrWhiteSpace(data.DownloadName) ? "HexaBill_backup.zip" : Path.GetFileName(data.DownloadName);
        var finalPath = Path.Combine(config.FolderPath!, downloadName);
        var partialPath = finalPath + ".partial";
        try
        {
            if (File.Exists(partialPath))
                File.Delete(partialPath);
            using (var response = await http.GetAsync($"/api/backup/agent/jobs/{data.RunId}/file", HttpCompletionOption.ResponseHeadersRead))
            {
                if (!response.IsSuccessStatusCode)
                    throw new HttpRequestException("download");
                await using var network = await response.Content.ReadAsStreamAsync();
                await using var file = new FileStream(partialPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                await network.CopyToAsync(file);
            }

            var actual = await HashFileAsync(partialPath);
            if (!string.Equals(actual, data.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                File.Delete(partialPath);
                await ReportAsync(http, data.RunId, false, actual, null, "Backup could not be verified.");
                Console.Error.WriteLine("Backup could not be verified.");
                return;
            }

            if (File.Exists(finalPath))
            {
                var existing = await HashFileAsync(finalPath);
                if (!string.Equals(existing, data.Sha256, StringComparison.OrdinalIgnoreCase))
                    File.Delete(finalPath);
                else
                    File.Delete(partialPath);
            }
            if (!File.Exists(finalPath))
                File.Move(partialPath, finalPath);

            var size = new FileInfo(finalPath).Length;
            ApplyRetention(config.FolderPath!, config.RetentionCount > 0 ? config.RetentionCount : 7, finalPath);
            await ReportAsync(http, data.RunId, true, actual, size, null);
            Console.WriteLine("Backup saved.");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or DirectoryNotFoundException or DriveNotFoundException or HttpRequestException)
        {
            TryDelete(partialPath);
            var reason = ex is HttpRequestException ? "Unable to reach HexaBill." : "Backup folder is unavailable.";
            await ReportAsync(http, data.RunId, false, null, null, reason);
            Console.Error.WriteLine(reason);
        }
    }

    private static void ApplyRetention(string folder, int keep, string protectedFile)
    {
        var files = Directory.GetFiles(folder, "HexaBill_*.zip")
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .ToList();
        foreach (var file in files.Skip(Math.Max(1, keep)))
        {
            if (string.Equals(Path.GetFullPath(file), Path.GetFullPath(protectedFile), StringComparison.OrdinalIgnoreCase))
                continue;
            TryDelete(file);
        }
    }

    private static async Task ReportAsync(HttpClient http, int runId, bool verified, string? hash, long? size, string? reason)
    {
        try
        {
            await http.PostAsJsonAsync($"/api/backup/agent/jobs/{runId}/report", new { verified, sha256 = hash, sizeBytes = size, failureReason = reason });
        }
        catch (HttpRequestException)
        {
            Console.Error.WriteLine("Unable to reach HexaBill.");
        }
    }

    private static async Task HeartbeatAsync(HttpClient http, string folder)
    {
        try
        {
            var config = Store.Load();
            await http.PostAsJsonAsync("/api/backup/agent/heartbeat", new
            {
                folderLabel = Path.GetFileName(folder.TrimEnd('\\', '/')),
                version = Version
            });
            if (config != null)
            {
                var settings = await http.GetFromJsonAsync<Envelope<ConfigResult>>("/api/backup/agent/config", Json);
                if (settings?.Data?.RetentionCount is > 0)
                {
                    config.RetentionCount = settings.Data.RetentionCount;
                    Store.Save(config, null);
                }
            }
        }
        catch (HttpRequestException)
        {
            Console.Error.WriteLine("Unable to reach HexaBill.");
        }
    }

    private static int ChooseFolderInteractive()
    {
        var folder = ChooseFolder();
        if (string.IsNullOrWhiteSpace(folder))
        {
            Console.Error.WriteLine("Backup folder is unavailable.");
            return 1;
        }
        var config = Store.Load() ?? new AgentConfig();
        config.FolderPath = folder;
        Store.Save(config, null);
        Console.WriteLine("Backup folder: " + Path.GetFileName(folder));
        return 0;
    }

    private static string? ChooseFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Choose a folder for HexaBill backups",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true
        };
        return dialog.ShowDialog() == DialogResult.OK ? dialog.SelectedPath : null;
    }

    private static int InstallLogonTask()
    {
        var exe = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exe))
            return 1;
        var args = $"/Create /F /TN \"HexaBill Backup Agent\" /SC ONLOGON /RL LIMITED /TR \"\\\"{exe}\\\" run\"";
        using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("schtasks", args)
        {
            UseShellExecute = false,
            CreateNoWindow = true
        });
        process?.WaitForExit();
        Console.WriteLine(process?.ExitCode == 0 ? "The agent will start when you sign in." : "Windows could not save the sign-in task.");
        return process?.ExitCode ?? 1;
    }

    private static HttpClient CreateClient(string apiBase, string? token = null)
    {
        var client = new HttpClient { BaseAddress = new Uri(NormalizeApi(apiBase)), Timeout = TimeSpan.FromMinutes(20) };
        if (!string.IsNullOrWhiteSpace(token))
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static string NormalizeApi(string api)
    {
        var trimmed = api.Trim().TrimEnd('/');
        if (trimmed.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[..^4];
        if (!trimmed.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            trimmed = "https://" + trimmed;
        return trimmed;
    }

    private static async Task<string> HashFileAsync(string path)
    {
        await using var stream = File.OpenRead(path);
        var hash = await SHA256.HashDataAsync(stream);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch (IOException) { }
    }

    private static string? Arg(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        return null;
    }

    private static string Prompt(string label, string? fallback = null)
    {
        Console.Write(label + (fallback == null ? ": " : $" [{fallback}]: "));
        var line = Console.ReadLine()?.Trim();
        return string.IsNullOrWhiteSpace(line) ? fallback ?? "" : line;
    }

    private sealed class Envelope<T>
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public T? Data { get; set; }
    }

    private sealed class PairResult
    {
        public string? Token { get; set; }
    }

    private sealed class JobResult
    {
        public bool Due { get; set; }
        public int RunId { get; set; }
        public string? DownloadName { get; set; }
        public string? Sha256 { get; set; }
        public bool AlreadyVerified { get; set; }
        public string? Message { get; set; }
    }

    private sealed class ConfigResult
    {
        public int RetentionCount { get; set; }
    }
}

internal sealed class AgentConfig
{
    public string ApiBase { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string? FolderPath { get; set; }
    public int RetentionCount { get; set; } = 7;
}

internal static class Store
{
    private static string Dir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HexaBill", "BackupAgent");
    private static string ConfigPath => Path.Combine(Dir, "config.json");
    private static string TokenPath => Path.Combine(Dir, "token.bin");

    public static void Save(AgentConfig config, string? token)
    {
        Directory.CreateDirectory(Dir);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config));
        if (!string.IsNullOrWhiteSpace(token))
        {
            var protectedBytes = System.Security.Cryptography.ProtectedData.Protect(
                System.Text.Encoding.UTF8.GetBytes(token), null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
            File.WriteAllBytes(TokenPath, protectedBytes);
        }
    }

    public static AgentConfig? Load()
    {
        if (!File.Exists(ConfigPath))
            return null;
        return JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(ConfigPath));
    }

    public static string? LoadToken()
    {
        if (!File.Exists(TokenPath))
            return null;
        var raw = System.Security.Cryptography.ProtectedData.Unprotect(
            File.ReadAllBytes(TokenPath), null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
        return System.Text.Encoding.UTF8.GetString(raw);
    }
}
