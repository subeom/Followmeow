Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FollowmeowIme {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);

  [DllImport("user32.dll")]
  public static extern IntPtr GetKeyboardLayout(uint idThread);

  [DllImport("imm32.dll")]
  public static extern IntPtr ImmGetDefaultIMEWnd(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern IntPtr SendMessageW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@

$window = [FollowmeowIme]::GetForegroundWindow()
if ($window -eq [IntPtr]::Zero) {
  throw "foreground-window-unavailable"
}

$threadId = [FollowmeowIme]::GetWindowThreadProcessId(
  $window,
  [IntPtr]::Zero
)
$layout = [FollowmeowIme]::GetKeyboardLayout($threadId).ToInt64() -band 0xFFFF
$imeWindow = [FollowmeowIme]::ImmGetDefaultIMEWnd($window)
$imeOpen = $false
if ($imeWindow -ne [IntPtr]::Zero) {
  $imeOpen = [FollowmeowIme]::SendMessageW(
    $imeWindow,
    0x283,
    [IntPtr]0x0005,
    [IntPtr]::Zero
  ).ToInt64() -ne 0
}

@{
  layoutId = "{0:X4}" -f $layout
  imeOpen = $imeOpen
} |
  ConvertTo-Json -Compress |
  Write-Output
