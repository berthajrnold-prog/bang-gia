# Registers scripts/local-agent.mjs to start hidden at Windows login (Startup folder)
# and starts it now. Remove: delete "BangGia-CaoFPT.vbs" from shell:startup.
$proj = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path ([Environment]::GetFolderPath("Startup")) "BangGia-CaoFPT.vbs"
$cmd = "cmd /c cd /d `"$proj`" && node --env-file=.env.local scripts\local-agent.mjs >> local-agent.log 2>&1"
$content = 'CreateObject("WScript.Shell").Run "' + $cmd.Replace('"', '""') + '", 0, False'
Set-Content -Path $vbs -Value $content -Encoding Unicode
Start-Process wscript.exe -ArgumentList "`"$vbs`""
Write-Host "Da cai dat: $vbs"
Write-Host "Chuong trinh dang chay ngam. Log: $proj\local-agent.log"
