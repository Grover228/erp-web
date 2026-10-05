param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName,

  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Print file not found: $FilePath"
}

$source = @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOC_INFO_1 di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten
    );
}
"@

Add-Type -TypeDefinition $source

$printerHandle = [IntPtr]::Zero
$docStarted = $false
$pageStarted = $false

try {
  if (-not [RawPrinter]::OpenPrinter($PrinterName, [ref]$printerHandle, [IntPtr]::Zero)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "OpenPrinter failed for '$PrinterName'. Win32 error: $code"
  }

  $docInfo = New-Object RawPrinter+DOC_INFO_1
  $docInfo.pDocName = "ERP TSPL Label"
  $docInfo.pOutputFile = $null
  $docInfo.pDataType = "RAW"

  $jobId = [RawPrinter]::StartDocPrinter($printerHandle, 1, $docInfo)
  if ($jobId -le 0) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "StartDocPrinter failed. Win32 error: $code"
  }
  $docStarted = $true

  if (-not [RawPrinter]::StartPagePrinter($printerHandle)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "StartPagePrinter failed. Win32 error: $code"
  }
  $pageStarted = $true

  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  $memory = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)

  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $memory, $bytes.Length)

    $written = 0
    if (-not [RawPrinter]::WritePrinter($printerHandle, $memory, $bytes.Length, [ref]$written)) {
      $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "WritePrinter failed. Win32 error: $code"
    }

    if ($written -ne $bytes.Length) {
      throw "WritePrinter wrote $written of $($bytes.Length) bytes."
    }
  }
  finally {
    if ($memory -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::FreeCoTaskMem($memory)
    }
  }
}
finally {
  if ($pageStarted) {
    [void][RawPrinter]::EndPagePrinter($printerHandle)
  }

  if ($docStarted) {
    [void][RawPrinter]::EndDocPrinter($printerHandle)
  }

  if ($printerHandle -ne [IntPtr]::Zero) {
    [void][RawPrinter]::ClosePrinter($printerHandle)
  }
}
