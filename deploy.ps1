# Script facilitador para deploy no Firebase Hosting
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   DEPLOY - MAPA INTERATIVO PACAEMBU     " -ForegroundColor Yellow
Write-Host "   Projeto: belavista3-vizinhos          " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Executa o deploy da pasta no Firebase Hosting
npx --yes -p firebase-tools firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deploy concluido com sucesso!" -ForegroundColor Green
    Write-Host "Acesse o mapa em: https://belavista3-vizinhos.web.app" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Dica: Se pediu login, execute primeiro: npx -p firebase-tools firebase login" -ForegroundColor Yellow
}
