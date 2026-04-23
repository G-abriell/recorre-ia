$htmlFile = "e:\Projetos\WEB\templates\index.html"
$dashboardFile = "e:\Projetos\WEB\dashboard-updated.html"

$content = Get-Content $htmlFile -Raw
$dashboardContent = Get-Content $dashboardFile -Raw

# Encontra e substitui a seção do dashboard
$pattern = '(?s)<section id="view-dashboard".*?</section>\s*(?=\s*<section id="view-analysis")'
$content = $content -replace $pattern, $dashboardContent

Set-Content -Path $htmlFile -Value $content -NoNewline
Write-Host "Dashboard atualizado com sucesso no index.html!"
