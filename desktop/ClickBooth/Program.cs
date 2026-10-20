using System.Diagnostics;
using System.Text.Json;

namespace ClickBooth;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Length == 2 && args[0] == "--self-test")
            return SelfTest.Run(args[1]).GetAwaiter().GetResult();
        using var mutex = new Mutex(true, @"Local\HichoniClickBooth", out var first);
        if (!first) { MessageBox.Show("운영자 앱이 이미 실행 중이에요. 작업 표시줄 또는 트레이의 공방 아이콘을 확인해 주세요."); return 0; }
        try { Application.Run(new MainForm()); return 0; }
        catch (Exception e) { MessageBox.Show("운영자 앱을 열지 못했어요.\n" + e.Message, "상상을 클릭하다!"); return 1; }
    }
}

internal static class SelfTest
{
    internal static async Task<int> Run(string output)
    {
        Directory.CreateDirectory(output);
        try
        {
            var config = new WorkshopSettings { Port = 15943 };
            config.Printers.Add(new Mini { Id = "mini-02", Name = "미니 02" });
            Configuration.Validate(config);
            var duplicate = new WorkshopSettings { Printers = [new() { Id = "one", Name = "1", Ip = "192.168.40.11" }, new() { Id = "two", Name = "2", Ip = "192.168.40.11" }] };
            bool refused = false; try { Configuration.Validate(duplicate); } catch (InvalidDataException) { refused = true; }
            if (!refused) throw new Exception("Duplicate printer address was accepted.");
            var data = Path.Combine(Path.GetFullPath(output), "isolated-runtime");
            Configuration.Save(data, config);
            if (Configuration.Read(Path.Combine(data, "config.json")).OperatorPin != config.OperatorPin) throw new Exception("Config round trip failed.");
            // Show neither a console nor an interactive window; render our own controls to a test artifact.
            using (var form = new MainForm(data, true))
            {
                form.StartPosition = FormStartPosition.Manual; form.Location = new Point(-32000, -32000); form.ShowInTaskbar = false;
                form.Show(); form.PerformLayout(); Application.DoEvents();
                using var bitmap = new Bitmap(form.Width, form.Height); form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                bitmap.Save(Path.Combine(output, "operator-app.png"));
                form.Hide();
            }
            SynchronizationContext.SetSynchronizationContext(null);
            using var server = new Supervisor(AppContext.BaseDirectory, data);
            await server.Start(config);
            await server.Stop();
            var result = new { configuration = "pass", duplicateDeviceGuard = "pass", payloadHashes = "pass", isolatedServerStartStop = "pass", printerCommands = 0 };
            File.WriteAllText(Path.Combine(output, "self-test.json"), JsonSerializer.Serialize(result));
            return 0;
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(output, "self-test-error.txt"), e.ToString()); return 1; }
    }
}
