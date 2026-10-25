param(
    [string]$Server = "72.62.247.63",
    [string]$Username = "root",
    [ValidateRange(1024, 65535)]
    [int]$LocalPort = 20128
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {
    throw "OpenSSH Client is required. Install it from Windows Optional Features."
}

Write-Host "Connecting to $Username@$Server. Authenticate in this window."
Write-Host "After connecting, open http://127.0.0.1:$LocalPort/dashboard in your browser."
Write-Host "Keep this window open. Press Ctrl+C to close the tunnel."

& ssh.exe -N -T `
    -o ExitOnForwardFailure=yes `
    -o ServerAliveInterval=30 `
    -o ServerAliveCountMax=3 `
    -L "127.0.0.1:${LocalPort}:127.0.0.1:20128" `
    "${Username}@${Server}"

if ($LASTEXITCODE -ne 0) {
    throw "SSH tunnel exited with code $LASTEXITCODE. Check SSH authentication and whether local port $LocalPort is already in use."
}
