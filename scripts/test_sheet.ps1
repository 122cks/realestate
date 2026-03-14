$lines = Get-Content .env.local
foreach ($line in $lines) {
  if ($line -match '^\s*([^=]+)=(.*)$') {
    $name = $matches[1]
    $value = $matches[2]
    Set-Item -Path Env:$name -Value $value
  }
}
$sheetId = $env:VITE_SPREADSHEET_ID
$apiKey = $env:VITE_GOOGLE_API_KEY
if (-not $apiKey) { Write-Error 'VITE_GOOGLE_API_KEY is empty'; exit 2 }
try {
  $res = Invoke-RestMethod -Uri "https://sheets.googleapis.com/v4/spreadsheets/$sheetId?fields=sheets(properties(sheetId,title))&key=$apiKey" -UseBasicParsing -ErrorAction Stop
  $res | ConvertTo-Json -Depth 5
} catch {
  Write-Error $_.Exception.Message
  exit 3
}
