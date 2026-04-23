$cssFile = "e:\Projetos\WEB\static\style.css"
$content = Get-Content $cssFile -Raw

$oldView = @"
.view {
    opacity: 0;
    transform: translateY(34px) scale(0.985);
    filter: blur(18px) saturate(0.88);
    pointer-events: none;
    transition:
        opacity 320ms ease,
        transform var(--transition-smooth),
        filter var(--transition-smooth);
}

.view.active {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0) saturate(1);
    pointer-events: auto;
}
"@

$newView = @"
.view {
    display: none;
    opacity: 0;
    transform: translateY(34px) scale(0.985);
    filter: blur(18px) saturate(0.88);
    pointer-events: none;
    transition:
        opacity 320ms ease,
        transform var(--transition-smooth),
        filter var(--transition-smooth);
}

.view.active {
    display: block;
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0) saturate(1);
    pointer-events: auto;
}
"@

$content = $content -replace [regex]::Escape($oldView), $newView
Set-Content -Path $cssFile -Value $content -NoNewline
Write-Host "CSS atualizado com sucesso!"
