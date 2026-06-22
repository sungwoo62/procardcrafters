# OMO-3736 — FedEx 테스트 라벨 출력 (Windows USB, 1회 다운로드 후 실행만)
#
# 실행:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\print-fedex-test-label.ps1"
#   - 새 라벨을 byte-perfect raw 로 받아 USB 라벨프린터로 그대로 출력합니다(이미지 변환 없음).
#   - "접근 거부"가 뜨면 PowerShell을 '관리자 권한으로 실행' 후 다시.
#
# 2D 바코드에 흰 틈이 남으면 아래 $Slow 를 $true 로 바꿔 다시 실행하세요(인쇄속도만 낮춤, 내용 동일).

$Key     = "certdde223da43eced40"          # 인증 테스트 키(샌드박스 전용)
$Printer = "Xprinter XP-DT108B LABEL"        # 다른 프린터면 이 이름만 변경 (Get-Printer 로 확인)
$Slow    = $false

# 1) raw ZPL 받기 (문자열 변환 없이 파일로 저장 = byte-perfect)
$uri = "https://procardcrafters.com/api/fedex/test-label?key=$Key&format=raw"
if ($Slow) { $uri += "&slow=1" }
$out = "$HOME\Downloads\fedex_label.zpl"
try {
  Invoke-WebRequest -Method Post -Uri $uri -OutFile $out -UseBasicParsing
} catch {
  Write-Host "라벨 받기 실패: $_" -ForegroundColor Red; Read-Host "엔터로 종료"; return
}
$bytes = [System.IO.File]::ReadAllBytes($out)   # 바이트 그대로(인코딩 변환 없음)
Write-Host ("ZPL 수신: {0} bytes -> {1}" -f $bytes.Length, $out)

# 2) winspool RAW 로 프린터에 그대로 전송 (윈도우 드라이버 렌더링 우회)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DI { [MarshalAs(UnmanagedType.LPWStr)] public string n; [MarshalAs(UnmanagedType.LPWStr)] public string o; [MarshalAs(UnmanagedType.LPWStr)] public string t; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr p);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int l, ref DI di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h, IntPtr b, int n, out int w);
  public static bool Send(string pr, byte[] bytes){ IntPtr h; if(!OpenPrinter(pr,out h,IntPtr.Zero)) return false; DI d=new DI(); d.n="FedEx ZPL"; d.t="RAW"; bool ok=false;
    if(StartDocPrinter(h,1,ref d)){ if(StartPagePrinter(h)){ IntPtr p=Marshal.AllocCoTaskMem(bytes.Length); Marshal.Copy(bytes,0,p,bytes.Length); int w; ok=WritePrinter(h,p,bytes.Length,out w); Marshal.FreeCoTaskMem(p); EndPagePrinter(h);} EndDocPrinter(h);} ClosePrinter(h); return ok; }
}
'@ -Language CSharp

if ([RawPrinter]::Send($Printer, $bytes)) {
  Write-Host ("출력 완료 -> {0}  (slow={1})" -f $Printer, $Slow) -ForegroundColor Green
  Write-Host "저장된 라벨 파일을 FedEx 메일에 첨부해도 됩니다: $out"
} else {
  Write-Host "출력 실패: 프린터 이름 확인 또는 관리자 권한으로 실행" -ForegroundColor Red
}
Read-Host "엔터로 종료"
