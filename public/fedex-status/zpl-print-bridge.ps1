# OMO-3736 — ZPL 프린트 브리지 (Windows USB, node 불필요)
# 1회만 실행해두면, 웹의 [ZPL 바로 출력] 버튼이 이 PC의 USB 라벨프린터로 바로 출력합니다.
# (스크립트를 매번 돌릴 필요 없음)
#
# 실행:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\zpl-print-bridge.ps1"
#   - "접근 거부/Access denied" 가 뜨면 PowerShell을 '관리자 권한으로 실행' 후 다시.
#   - 이 창을 열어두면 됩니다 (종료: Ctrl+C). 컴퓨터 켤 때 자동 실행하려면 아래 '자동시작' 참고.

$Printer = "Xprinter XP-DT108B LABEL"   # 다른 프린터면 이 이름만 변경 (Get-Printer 로 확인)
$Port    = 9110

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr p);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int lvl, ref DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, IntPtr buf, int n, out int written);
  public static bool Send(string printer, byte[] bytes) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    DOCINFO di = new DOCINFO(); di.pDocName = "FedEx ZPL"; di.pDataType = "RAW"; bool ok = false;
    if (StartDocPrinter(h, 1, ref di)) {
      if (StartPagePrinter(h)) {
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length); Marshal.Copy(bytes, 0, p, bytes.Length);
        int w; ok = WritePrinter(h, p, bytes.Length, out w); Marshal.FreeCoTaskMem(p); EndPagePrinter(h);
      }
      EndDocPrinter(h);
    }
    ClosePrinter(h); return ok;
  }
}
'@ -Language CSharp

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
  Write-Host "리스너 시작 실패. 'PowerShell을 관리자 권한으로 실행' 후 재시도하거나, 관리자 창에서 아래 1회 실행:" -ForegroundColor Yellow
  Write-Host "  netsh http add urlacl url=http://localhost:$Port/ user=Everyone" -ForegroundColor Yellow
  Read-Host "엔터로 종료"; return
}

Write-Host ("ZPL 프린트 브리지 실행 중 -> http://localhost:{0}  (프린터: {1})" -f $Port, $Printer) -ForegroundColor Green
Write-Host "이 창을 열어두세요. 웹에서 [ZPL 바로 출력]을 누르면 여기로 와서 라벨이 출력됩니다. (종료: Ctrl+C)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  $res.Headers.Add("Access-Control-Allow-Origin", "*")
  $res.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Printer-Host, X-Printer-Port")
  try {
    if ($req.HttpMethod -eq "OPTIONS") { $res.StatusCode = 204 }
    elseif ($req.Url.AbsolutePath -eq "/health") {
      $res.ContentType = "application/json"
      $b = [Text.Encoding]::UTF8.GetBytes('{"ok":true,"printer":"' + $Printer + '"}')
      $res.OutputStream.Write($b, 0, $b.Length)
    }
    elseif ($req.HttpMethod -eq "POST" -and $req.Url.AbsolutePath -eq "/print") {
      $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $zpl = $sr.ReadToEnd(); $sr.Close()
      $bytes = [Text.Encoding]::ASCII.GetBytes($zpl)
      $ok = [RawPrinter]::Send($Printer, $bytes)
      $res.ContentType = "application/json"
      if ($ok) {
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":true,"bytes":' + $bytes.Length + ',"printer":"' + $Printer + '"}')
        Write-Host ("출력: {0} bytes -> {1}" -f $bytes.Length, $Printer) -ForegroundColor Green
      } else {
        $res.StatusCode = 502
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"print failed - check printer name/power"}')
        Write-Host "출력 실패 (프린터 이름/전원 확인)" -ForegroundColor Red
      }
      $res.OutputStream.Write($b, 0, $b.Length)
    }
    else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 }
  $res.Close()
}

# === 자동시작 (선택) — 컴퓨터 켤 때마다 자동 실행하려면 관리자 PowerShell에서 1회: ===
#   $a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$HOME\Downloads\zpl-print-bridge.ps1`""
#   $t = New-ScheduledTaskTrigger -AtLogOn
#   Register-ScheduledTask -TaskName "ZplPrintBridge" -Action $a -Trigger $t -RunLevel Highest -Force
