# Script facilitador para rodar a versao local de testes (sem alterar o Firebase de producao)
$port = 8080

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   AMBIENTE LOCAL - BELA VISTA III (PACAEMBU)     " -ForegroundColor Yellow
Write-Host "   Modo seguro: gravacoes isoladas no navegador   " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Acesse nos links abaixo:" -ForegroundColor White
Write-Host "  Mapa Interativo: http://localhost:$port" -ForegroundColor Cyan
Write-Host "  Planta Baixa 2D: http://localhost:$port/planta.html" -ForegroundColor Cyan
Write-Host "  Modelo 3D:       http://localhost:$port/modelo3d.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione Ctrl+C para encerrar o servidor local." -ForegroundColor Gray
Write-Host ""

python -m http.server $port --bind 127.0.0.1
