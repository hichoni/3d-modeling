using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json;

namespace ClickBooth;

public sealed class MainForm : Form
{
    private readonly string data;
    private readonly bool demonstration;
    private WorkshopSettings config;
    private readonly Supervisor server;
    private readonly BindingList<Mini> minis = new();
    private readonly DataGridView grid = new();
    private readonly TextBox slicer = new(), pin = new();
    private readonly ComboBox host = new();
    private readonly CheckBox booth = new() { Text = "크롬북 접속 허용 · 같은 Wi-Fi", AutoSize = true };
    private readonly Label status = new() { AutoSize = true, MaximumSize = new Size(1050, 0), ForeColor = Color.FromArgb(25, 56, 89) };
    private readonly Button start = new(), stop = new(), browser = new(), share = new();
    private readonly List<Control> editors = new();
    private readonly NotifyIcon tray;
    private bool changing;

    public MainForm(string? testData = null, bool testMode = false)
    {
        demonstration = testMode;
        data = testData ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Hichoni", "ClickBooth");
        var file = Path.Combine(data, "config.json");
        config = File.Exists(file) ? Configuration.Read(file) : new WorkshopSettings();
        server = new Supervisor(AppContext.BaseDirectory, data);
        server.Notice += message => { if (IsHandleCreated && !IsDisposed) BeginInvoke(() => { SetStatus(message); UpdateControls(); }); };
        Text = "상상을 클릭하다! · 운영자 공방"; ClientSize = new Size(1080, 780); MinimumSize = new Size(980, 740);
        StartPosition = FormStartPosition.CenterScreen; Font = new Font("맑은 고딕", 10); BackColor = Color.FromArgb(255, 249, 237);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(26), ColumnCount = 1, RowCount = 8 };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 60)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 160)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        Controls.Add(layout);
        layout.Controls.Add(new Label { Text = "상상을 클릭하다!  운영자 공방", Font = new Font(Font.FontFamily, 23, FontStyle.Bold), AutoSize = true, ForeColor = Color.FromArgb(26, 52, 80), Padding = new Padding(0, 5, 0, 0) });
        layout.Controls.Add(new Label { Text = "① 미니 등록    →    ② 공방 시작    →    ③ 크롬북에서 1:1 매칭\n크롬북에는 설치하지 않아요. 출력 PC 한 대가 여러 미니를 연결해요.", AutoSize = true });
        ConfigureGrid(); layout.Controls.Add(grid);
        var miniActions = new FlowLayoutPanel { Dock = DockStyle.Fill };
        var add = ActionButton("+ 미니 추가", () => AddMini());
        var remove = ActionButton("선택 미니 삭제", () => { if (grid.CurrentRow?.DataBoundItem is Mini mini && minis.Count > 1) minis.Remove(mini); });
        var import = ActionButton("기존 설정 가져오기", Import);
        miniActions.Controls.AddRange([add, remove, import]); layout.Controls.Add(miniActions); editors.AddRange([add, remove, import, grid]);
        var settings = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 3 };
        settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130)); settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
        settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 48)); settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 48)); settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        settings.Controls.Add(new Label { Text = "대체 계산 (선택)", AutoSize = true }, 0, 0); slicer.Dock = DockStyle.Fill;
        settings.Controls.Add(slicer, 1, 0); var browse = ActionButton("실행 파일 찾기", BrowseSlicer); settings.Controls.Add(browse, 2, 0);
        settings.Controls.Add(new Label { Text = "공방 PC 주소", AutoSize = true }, 0, 1); host.Dock = DockStyle.Fill; host.DropDownStyle = ComboBoxStyle.DropDownList;
        settings.Controls.Add(host, 1, 1); var refresh = ActionButton("주소 새로고침", RefreshAddresses); settings.Controls.Add(refresh, 2, 1);
        settings.Controls.Add(new Label { Text = "운영자 PIN", AutoSize = true }, 0, 2); pin.UseSystemPasswordChar = true; pin.MaxLength = 12; pin.Dock = DockStyle.Left; pin.Width = 180;
        var pinRow = new FlowLayoutPanel { Dock = DockStyle.Fill }; var reveal = new CheckBox { Text = "PIN 보기", AutoSize = true }; reveal.CheckedChanged += (_, _) => pin.UseSystemPasswordChar = !reveal.Checked;
        pinRow.Controls.AddRange([pin, reveal, booth]); settings.Controls.Add(pinRow, 1, 2); settings.SetColumnSpan(pinRow, 2);
        editors.AddRange([slicer, browse, host, refresh, pin, reveal, booth]); layout.Controls.Add(settings);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        SetupButton(start, "설정 저장 · 공방 시작", Color.FromArgb(255, 84, 112)); start.Click += async (_, _) => await StartServer();
        SetupButton(browser, "운영자 화면 열기", Color.FromArgb(38, 133, 190)); browser.Click += (_, _) => Open("http://127.0.0.1:" + config.Port + "/");
        SetupButton(share, "크롬북 링크 복사", Color.FromArgb(0, 128, 111)); share.Click += (_, _) => { Clipboard.SetText(Configuration.ParticipantLink(config)); SetStatus("부스 링크를 복사했어요. 같은 Wi-Fi의 크롬북에 공유해 주세요."); };
        SetupButton(stop, "공방 중지", Color.FromArgb(94, 110, 130)); stop.Click += async (_, _) => await StopServer();
        actions.Controls.AddRange([start, browser, share, stop]); layout.Controls.Add(actions); layout.Controls.Add(status);
        layout.Controls.Add(new Label { Text = "본체: LAN Only + Developer Mode · 0.4mm 노즐 · 외부 PLA · 텍스처 PEI\n출력은 웹에서 빈 베드와 재료를 확인한 작품만 시작해요. 앱은 방화벽·보안 정책을 바꾸지 않아요.", AutoSize = true, ForeColor = Color.DimGray });
        var menu = new ContextMenuStrip(); menu.Items.Add("운영자 공방 열기", null, (_, _) => Restore());
        menu.Items.Add("공방 중지 후 앱 종료", null, async (_, _) => { if (await StopServer()) { tray!.Visible = false; Close(); } });
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "상상을 클릭하다! 공방", ContextMenuStrip = menu }; tray.DoubleClick += (_, _) => Restore();
        FormClosing += (_, e) => { if (changing) { e.Cancel = true; return; } if (server.Running) { e.Cancel = true; Hide(); tray.Visible = true; tray.ShowBalloonTip(2500, "공방은 계속 실행 중이에요", "트레이 아이콘에서 다시 열거나 작업 확인 후 종료할 수 있어요.", ToolTipIcon.Info); } };
        FormClosed += (_, _) => { tray.Dispose(); server.Dispose(); };
        LoadFields(); if (!testMode) SetStatus("미니 이름과 주소를 확인하고 공방을 시작해 주세요. 접근 코드·PIN은 이 PC 사용자 데이터에만 저장돼요.");
        UpdateControls();
    }
    private static void SetupButton(Button b, string text, Color color) { b.Text = text; b.AutoSize = true; b.Height = 40; b.Padding = new Padding(9, 5, 9, 5); b.FlatStyle = FlatStyle.Flat; b.BackColor = color; b.ForeColor = Color.White; b.FlatAppearance.BorderSize = 0; b.Cursor = Cursors.Hand; }
    private Button ActionButton(string text, Action handler) { var button = new Button { Text = text, AutoSize = true, Height = 34, Padding = new Padding(5), Cursor = Cursors.Hand }; button.Click += (_, _) => { try { handler(); } catch (Exception e) { ShowError(e); } }; return button; }
    private void ConfigureGrid()
    {
        grid.Dock = DockStyle.Fill; grid.AutoGenerateColumns = false; grid.AllowUserToAddRows = false; grid.AllowUserToDeleteRows = false; grid.RowHeadersVisible = false;
        grid.BackgroundColor = Color.White; grid.BorderStyle = BorderStyle.None; grid.RowTemplate.Height = 34; grid.DataSource = minis; grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        foreach (var column in new[] { ("Id", "ID", 88), ("Name", "미니 이름", 135), ("Ip", "프린터 IP", 145), ("Serial", "일련번호", 165), ("AccessCode", "접근 코드", 130), ("OperatorPin", "미니 PIN · 선택", 120) })
            grid.Columns.Add(new DataGridViewTextBoxColumn { DataPropertyName = column.Item1, Name = column.Item1, HeaderText = column.Item2, Width = column.Item3, ReadOnly = column.Item1 == "Id", AutoSizeMode = column.Item1 == "Name" ? DataGridViewAutoSizeColumnMode.Fill : DataGridViewAutoSizeColumnMode.None });
        grid.CellFormatting += (_, e) => { if (grid.Columns[e.ColumnIndex].Name is "AccessCode" or "OperatorPin" && e.Value is string value && value.Length > 0) { e.Value = "••••••"; e.FormattingApplied = true; } };
        grid.EditingControlShowing += (_, e) => { if (e.Control is TextBox text) text.UseSystemPasswordChar = grid.CurrentCell?.OwningColumn?.Name is "AccessCode" or "OperatorPin"; };
    }
    private void LoadFields()
    {
        minis.Clear(); foreach (var p in config.Printers) minis.Add(p);
        slicer.Text = config.SlicerPath; pin.Text = config.OperatorPin; booth.Checked = config.Booth.Enabled;
        RefreshAddresses();
    }
    private void RefreshAddresses()
    {
        var before = host.SelectedItem as string ?? config.Booth.Host; host.Items.Clear(); host.Items.AddRange(demonstration ? new[] { "192.168.40.10" } : Configuration.Addresses());
        if (host.Items.Contains(before)) host.SelectedItem = before; else if (host.Items.Count > 0) host.SelectedIndex = 0;
    }
    private void AddMini()
    {
        if (minis.Count >= 32) throw new InvalidOperationException("최대 32대까지 등록할 수 있어요.");
        var n = 1; while (minis.Any(m => m.Id == "mini-" + n.ToString("00"))) n++;
        minis.Add(new Mini { Id = "mini-" + n.ToString("00"), Name = "미니 " + n.ToString("00") });
    }
    private void BrowseSlicer()
    {
        using var picker = new OpenFileDialog { Filter = "Bambu Studio (bambu-studio.exe)|bambu-studio.exe", Title = "Bambu Studio 실행 파일 선택" };
        if (picker.ShowDialog(this) == DialogResult.OK) slicer.Text = picker.FileName;
    }
    private void Import()
    {
        using var picker = new OpenFileDialog { Filter = "공방 설정 (config.json)|config.json", Title = "기존 runtime 폴더의 config.json 선택" };
        if (picker.ShowDialog(this) != DialogResult.OK) return;
        var imported = Configuration.Read(picker.FileName); Configuration.Validate(imported); config = imported; config.Port = 5188; LoadFields();
        SetStatus("설정을 불러왔어요. 기존 접수·매칭·출력 파일은 이동하지 않아요. 기존 공방의 작업을 정리한 뒤 새 공방을 시작해 주세요.");
    }
    private void ReadFields()
    {
        grid.EndEdit(); (BindingContext?[minis] as CurrencyManager)?.EndCurrentEdit();
        config.Printers = minis.ToList(); config.SlicerPath = slicer.Text.Trim(); config.OperatorPin = pin.Text.Trim();
        config.Booth.Enabled = booth.Checked; config.Booth.Host = host.SelectedItem as string ?? "";
        Configuration.Validate(config); Configuration.Save(data, config);
    }
    private async Task StartServer()
    {
        if (changing || server.Running) return; changing = true; UpdateControls();
        try { ReadFields(); SetStatus("앱 구성 파일을 확인하고 공방을 시작하고 있어요…"); await server.Start(config); SetStatus("공방 실행 중 · " + config.Printers.Count + "대 등록. 운영자 화면에서 연결 상태를 확인하고 크롬북 링크를 공유해 주세요."); }
        catch (Exception e) { ShowError(e); }
        finally { changing = false; UpdateControls(); }
    }
    private async Task<bool> StopServer()
    {
        if (changing) return false; changing = true; UpdateControls();
        try { await server.Stop(); SetStatus("공방을 중지했어요. 다시 시작하면 저장된 매칭과 접수를 불러와요."); return true; }
        catch (Exception e) { ShowError(e); return false; }
        finally { changing = false; UpdateControls(); }
    }
    private void UpdateControls()
    {
        foreach (var control in editors) control.Enabled = !changing && !server.Running;
        start.Enabled = !changing && !server.Running; stop.Enabled = !changing && server.Running;
        browser.Enabled = !changing && server.Running; share.Enabled = !changing && server.Running && config.Booth.Enabled;
    }
    private void Restore() { Show(); WindowState = FormWindowState.Normal; Activate(); tray.Visible = false; }
    private void SetStatus(string message) => status.Text = message;
    private void ShowError(Exception e) { SetStatus(e.Message); MessageBox.Show(this, e.Message, "공방 안내", MessageBoxButtons.OK, MessageBoxIcon.Information); }
    private static void Open(string url) => Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
}
