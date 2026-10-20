using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;

namespace ClickBooth;

public static class Payload
{
    public static void Verify(string root)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ClickBooth.Resources.payload-manifest.json") ?? throw new InvalidDataException("구성 파일 목록이 없어요.");
        var list = JsonSerializer.Deserialize<Dictionary<string, string>>(stream) ?? throw new InvalidDataException("구성 파일 목록이 잘못됐어요.");
        if (!list.ContainsKey("payload/node.exe") || !list.ContainsKey("payload/bridge/server.cjs")) throw new InvalidDataException("앱 구성 파일이 준비되지 않았어요.");
        foreach (var pair in list)
        {
            var file = Path.GetFullPath(Path.Combine(root, pair.Key));
            if (!file.StartsWith(Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("앱 구성 파일 경로가 잘못됐어요.");
            using var bytes = File.OpenRead(file);
            if (!Convert.ToHexString(SHA256.HashData(bytes)).Equals(pair.Value, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("앱 파일이 변경됐어요. 승인된 설치본으로 다시 설치해 주세요.");
        }
    }
}

public sealed class Supervisor : IDisposable
{
    private readonly string root, data;
    private Process? child;
    private string nonce = "", instance = "";
    private TaskCompletionSource<JsonElement>? shutdownReply;
    public event Action<string>? Notice;
    public bool Running => child is not null && !child.HasExited;
    public bool WasStarted { get; private set; }
    public Supervisor(string root, string data) { this.root = root; this.data = data; }

    public async Task Start(WorkshopSettings settings)
    {
        if (Running) return;
        Payload.Verify(root);
        if (settings.Booth.Enabled && !Configuration.Addresses().Contains(settings.Booth.Host)) throw new InvalidOperationException("PC의 Wi-Fi 주소가 바뀌었어요. 주소를 다시 선택하고 저장해 주세요.");
        using (var probe = new System.Net.Sockets.TcpClient())
        {
            try { await probe.ConnectAsync("127.0.0.1", settings.Port).WaitAsync(TimeSpan.FromSeconds(1)); }
            catch (System.Net.Sockets.SocketException) { goto Available; }
            catch (TimeoutException) { throw new InvalidOperationException("공방 포트 사용 여부를 확인할 수 없어요."); }
            throw new InvalidOperationException("같은 포트의 공방이 이미 실행 중이에요. 기존 공방의 작업 상태를 확인하고 종료한 뒤 다시 시작해 주세요.");
        }
        Available:
        nonce = Configuration.RandomKey(); instance = Guid.NewGuid().ToString("N");
        var start = new ProcessStartInfo(Path.Combine(root, "payload", "node.exe"))
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.Combine(root, "payload"),
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
        };
        start.ArgumentList.Add(Path.Combine(root, "payload", "bridge", "server.cjs"));
        start.Environment.Remove("NODE_OPTIONS"); start.Environment.Remove("NODE_PATH");
        start.Environment["CLICK_RUNTIME"] = data; start.Environment["CLICK_PORT"] = settings.Port.ToString();
        start.Environment["CLICK_DESKTOP_CONTROL"] = nonce; start.Environment["CLICK_DESKTOP_INSTANCE"] = instance;
        child = new Process { StartInfo = start, EnableRaisingEvents = true };
        child.OutputDataReceived += (_, e) =>
        {
            if (e.Data?.StartsWith("@desktop:") == true)
                try { using var d = JsonDocument.Parse(e.Data[9..]); shutdownReply?.TrySetResult(d.RootElement.Clone()); } catch (JsonException) { }
        };
        child.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Notice?.Invoke("공방에서 오류가 발생했어요. 설정과 네트워크를 확인해 주세요."); };
        child.Exited += (_, _) => Notice?.Invoke("공방이 중지되었습니다.");
        child.Start(); WasStarted = true; child.BeginOutputReadLine(); child.BeginErrorReadLine();
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        for (int attempt = 0; attempt < 40; attempt++)
        {
            if (!Running) throw new InvalidOperationException("공방이 시작되지 않았어요. 포트·설정·실행 정책을 확인해 주세요.");
            try
            {
                using var response = await http.GetAsync("http://127.0.0.1:" + settings.Port + "/api/bootstrap");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (json.RootElement.TryGetProperty("desktopInstance", out var actual) && actual.GetString() == instance) return;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException) { }
            await Task.Delay(250);
        }
        throw new InvalidOperationException("시작 확인에 시간이 걸려요. 이 창을 유지하고 상태를 확인해 주세요.");
    }
    public async Task Stop()
    {
        if (!Running) return;
        shutdownReply = new(TaskCreationOptions.RunContinuationsAsynchronously);
        await child!.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { type = "shutdown", nonce }));
        await child.StandardInput.FlushAsync();
        JsonElement answer;
        try { answer = await shutdownReply.Task.WaitAsync(TimeSpan.FromSeconds(8)); }
        catch (TimeoutException) { throw new InvalidOperationException("종료 응답을 확인하지 못했어요. 강제 종료하지 않았습니다."); }
        if (!answer.GetProperty("ok").GetBoolean()) throw new InvalidOperationException("슬라이싱·전송·출력 또는 결과 확인이 진행 중이에요. 운영자 화면에서 작업을 확인한 뒤 중지해 주세요.");
        await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(8));
        child.Dispose(); child = null;
    }
    public void Dispose() { if (!Running) child?.Dispose(); } // Never kill a printer bridge on a UI exception.
}
