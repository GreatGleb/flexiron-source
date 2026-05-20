$lines = Get-Content 'src/mocks/warehouse-batches.ts' -Encoding UTF8
$dict = @{}
$i = 0
while ($i -lt $lines.Length) {
  $line = $lines[$i]
  if ($line -match "productId: '(prod-\d+)'") {
    $pid = $matches[1]
    $j = $i + 1
    while ($j -lt $lines.Length -and $lines[$j] -notmatch 'productId:') {
      if ($lines[$j] -match "productName: \{ ru: '(.+?)'") {
        $dict[$pid] = $matches[1]
        break
      }
      $j++
    }
  }
  $i++
}
$dict.Keys | Sort-Object | ForEach-Object { Write-Host "$_|$($dict[$_])" }
