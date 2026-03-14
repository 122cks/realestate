$envFile = '.env.local'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^=]+)=(.*)$') {
      $name = $matches[1]
      $value = $matches[2].Trim()
      Set-Item -Path Env:$name -Value $value
    }
  }
}
$key = $env:VITE_KAKAO_JS_KEY
if (-not $key) { Write-Error 'VITE_KAKAO_JS_KEY is empty'; exit 2 }
$url = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=$key&libraries=services"
try {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method GET -TimeoutSec 15
  Write-Output "StatusCode: $($r.StatusCode)"
  $content = $r.Content
  if ($null -ne $content) {
    if ($content.Length -gt 800) { Write-Output $content.Substring(0,800) } else { Write-Output $content }
  } else {
    Write-Output "No content"
  }
} catch {
  Write-Error $_.Exception.Message
  exit 3
}
