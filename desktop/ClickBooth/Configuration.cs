using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ClickBooth;

public sealed class Mini
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Ip { get; set; } = "";
    public string Serial { get; set; } = "";
    public string AccessCode { get; set; } = "";
    public string OperatorPin { get; set; } = "";
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extra { get; set; }
}

public sealed class BoothSettings
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = "";
    public string Key { get; set; } = Configuration.RandomKey();
}

public sealed class WorkshopSettings
{
    public int Port { get; set; } = 5188;
    public string SlicerPath { get; set; } = @"C:\Program Files\Bambu Studio\bambu-studio.exe";
    public string OperatorPin { get; set; } = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    public BoothSettings Booth { get; set; } = new();
    public List<Mini> Printers { get; set; } = [new() { Id = "mini-01", Name = "미니 01" }];
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extra { get; set; }
}

public static class Configuration
{
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    public static string RandomKey() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static bool PrivateIp(string value) => IPAddress.TryParse(value, out var ip) && ip.ToString() == value && ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork &&
        (ip.GetAddressBytes()[0] == 10 || ip.GetAddressBytes()[0] == 192 && ip.GetAddressBytes()[1] == 168 || ip.GetAddressBytes()[0] == 172 && ip.GetAddressBytes()[1] >= 16 && ip.GetAddressBytes()[1] <= 31);
    public static string[] Addresses() => NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up)
        .SelectMany(n => n.GetIPProperties().UnicastAddresses).Select(n => n.Address.ToString()).Where(PrivateIp).Distinct().ToArray();
    public static WorkshopSettings Read(string file)
    {
        var value = JsonSerializer.Deserialize<WorkshopSettings>(File.ReadAllText(file), Json) ?? throw new InvalidDataException("설정 파일을 읽을 수 없어요.");
        // Preserve old printer identities when importing the original single-printer configuration.
        if (value.Extra?.Remove("printer", out var legacy) == true)
        {
            var mini = legacy.Deserialize<Mini>(Json) ?? new Mini(); mini.Id = "mini-01";
            if (string.IsNullOrWhiteSpace(mini.Name)) mini.Name = "미니 01";
            value.Printers = [mini];
        }
        return value;
    }
    public static void Validate(WorkshopSettings c, bool requireSlicer = false)
    {
        if (c.Port < 1024 || c.Port > 65535) throw new InvalidDataException("공방 포트가 올바르지 않아요.");
        if (!Regex.IsMatch(c.OperatorPin ?? "", @"^[0-9]{6,12}$")) throw new InvalidDataException("운영자 PIN은 숫자 6~12자리로 입력해 주세요.");
        if (c.Printers is null || c.Printers.Count < 1 || c.Printers.Count > 32) throw new InvalidDataException("미니는 1~32대를 등록할 수 있어요.");
        var ids = new HashSet<string>(); var ips = new HashSet<string>(); var serials = new HashSet<string>();
        foreach (var p in c.Printers)
        {
            if (!Regex.IsMatch(p.Id ?? "", @"^[a-zA-Z0-9_-]{1,32}$") || !ids.Add(p.Id ?? "")) throw new InvalidDataException("미니 ID가 잘못됐거나 중복됐어요.");
            if (string.IsNullOrWhiteSpace(p.Name) || p.Name.Length > 40) throw new InvalidDataException("미니 이름은 1~40자로 입력해 주세요.");
            if (p.Ip.Length > 0 && (!PrivateIp(p.Ip) || !ips.Add(p.Ip))) throw new InvalidDataException("각 미니에는 서로 다른 사설 IPv4 주소를 입력해 주세요.");
            if (p.Serial.Length > 0 && (!Regex.IsMatch(p.Serial, @"^[a-zA-Z0-9_-]{5,40}$") || !serials.Add(p.Serial))) throw new InvalidDataException("일련번호가 잘못됐거나 중복됐어요.");
            if (p.OperatorPin.Length > 0 && !Regex.IsMatch(p.OperatorPin, @"^[0-9]{6,12}$")) throw new InvalidDataException("미니별 PIN은 숫자 6~12자리로 입력해 주세요.");
            if (p.AccessCode.Contains('\n') || p.AccessCode.Contains('\r')) throw new InvalidDataException("접근 코드에 줄바꿈을 넣을 수 없어요.");
        }
        if (c.Booth is null || !Regex.IsMatch(c.Booth.Key ?? "", "^[a-f0-9]{64}$")) throw new InvalidDataException("부스 접속 키가 올바르지 않아요.");
        if (c.Booth.Enabled && !PrivateIp(c.Booth.Host)) throw new InvalidDataException("부스 Wi-Fi에 연결하고 이 PC의 주소를 선택해 주세요.");
        if (requireSlicer && (!File.Exists(c.SlicerPath) || !c.SlicerPath.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))) throw new InvalidDataException("Bambu Studio 실행 파일을 찾아주세요. 이 앱에는 Bambu Studio가 포함되어 있지 않아요.");
    }
    public static void Save(string directory, WorkshopSettings value)
    {
        Validate(value); Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, "config.json");
        File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(value, Json)); File.Move(file + ".tmp", file, true);
    }
    public static string ParticipantLink(WorkshopSettings value) => "https://hichoni.github.io/3d-modeling/#booth=" + Uri.EscapeDataString("http://" + value.Booth.Host + ":" + value.Port) + "&key=" + value.Booth.Key;
}
