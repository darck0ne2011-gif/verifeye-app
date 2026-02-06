# Setup Python venv and install Voice Clone deps for VerifEye
# Run: .\setup-venv.ps1

$py = $env:VERIFEYE_PYTHON
if (-not $py) {
  $py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  if (-not (Test-Path $py)) { $py = "python" }
}

Write-Host "Using Python: $py"
& $py -m venv venv
& .\venv\Scripts\pip.exe install -r requirements.txt
Write-Host "Done. Add to .env: VERIFEYE_PYTHON=$((Resolve-Path .\venv\Scripts\python.exe).Path)"
