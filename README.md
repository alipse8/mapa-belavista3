# 🏡 Mapa Interativo dos Vizinhos • Residencial Bela Vista III (Pacaembu)

Um mapa interativo completo e responsivo (otimizado para celular e computador) desenvolvido a partir da planta oficial de implantação (Página 21 do Book do Corretor), cobrindo **todas as 21 quadras (Blocos A a U)** e **988 lotes residenciais**.

O objetivo é permitir que os futuros moradores e vizinhos se encontrem, vejam quem comprou cada lote, conversem diretamente no WhatsApp e acompanhem o andamento das obras da comunidade!

---

## 🌟 Principais Recursos

- 🗺️ **Planta Oficial de Alta Resolução**: Imagem nítida em formato WebP otimizado (1.5 MB), com navegação suave por toque (*pinch-to-zoom*) no celular ou roda do mouse no desktop.
- 🎯 **Navegação Rápida por Quadras (A a U)**: Barra de atalhos no topo para dar zoom instantâneo em qualquer bloco.
- 🔍 **Busca Inteligente**: Encontre rapidamente qualquer lote (ex: `B-14`, `Quadra H`) ou busque vizinhos pelo nome (ex: `Jean`, `Carlos`).
- 📝 **Cadastro Simples de Morador**:
  - Seleção da Quadra e Lote
  - Nome completo ou da família
  - Telefone / WhatsApp com máscara automática
  - Situação da obra: *Em obras 🏗️*, *Em projeto 📐*, *Terreno quitado 🔑*, *Já morando 🏡*, *Investimento 📈*
  - Recado / Mensagem pública para a vizinhança
- 💬 **Botão Direto para o WhatsApp**: Clique no lote de um vizinho e abra a conversa no WhatsApp já com mensagem personalizada de apresentação.
- 👥 **Diretório Geral de Moradores**: Lista completa e pesquisável de todos os vizinhos cadastrados com botão de contato e "Ver no Mapa".
- 📊 **Painel de Estatísticas**: Percentual de vizinhos encontrados e ranking de quadras mais ativas.
- 💾 **Persistência de Dados Flexível**:
  - **Modo Local (LocalStorage)**: Funciona imediatamente sem qualquer configuração.
  - **Firebase Realtime Database (Nuvem)**: Sincronização em tempo real entre todos os celulares dos vizinhos (100% gratuito).
  - **Google Sheets (Opcional)**: Integração com planilha Google via Apps Script.
  - **Exportação Excel / CSV**: Baixe a lista de contatos em planilha a qualquer momento.

---

## 🚀 Como Testar no seu Computador Agora

Basta dar dois cliques no arquivo `index.html` para abrir diretamente no seu navegador de preferência (Google Chrome, Microsoft Edge, Firefox, etc.).

Ou, se preferir via linha de comando:
```powershell
python -m http.server 8000
```
E acesse no navegador: `http://localhost:8000`

---

## 🌐 Como Publicar no GitHub Pages (`*.github.io`)

Como o projeto é estático (HTML/CSS/JavaScript puro), você pode hospedá-lo **gratuitamente** no GitHub Pages:

1. **Crie um repositório no seu GitHub**:
   - Acesse [github.com/new](https://github.com/new)
   - Nomeie o repositório (ex: `mapa-bela-vista` ou `vizinhos-pacaembu`)
   - Deixe o repositório como **Público** e clique em **Create repository**.

2. **Envie os arquivos da pasta para o GitHub**:
   Abra o terminal PowerShell nesta pasta (`C:\Users\jean.pedroso\Desktop\Pacaembu`) e execute:
   ```bash
   git init
   git add .
   git commit -m "Versao inicial do Mapa Interativo Pacaembu"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

3. **Ative o GitHub Pages**:
   - No seu repositório no GitHub, clique na aba **Settings** (Configurações).
   - No menu lateral esquerdo, clique em **Pages**.
   - Em **Build and deployment > Source**, selecione **Deploy from a branch**.
   - Em **Branch**, selecione `main` e a pasta `/ (root)`.
   - Clique em **Save**.

4. **Pronto!**
   Em cerca de 1 a 2 minutos, o GitHub gerará o link oficial:
   `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`

---

## ☁️ Como Sincronizar os Cadastros entre Todos os Celulares (Firebase Grátis)

Por padrão, quando hospedado no GitHub Pages, os navegadores usam o *LocalStorage* (cada pessoa vê o que salvou no seu próprio aparelho).

Para que **todos os vizinhos vejam os cadastros uns dos outros em tempo real** ao acessarem o link pelo celular:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/) com sua conta Google.
2. Clique em **Adicionar projeto** e dê um nome (ex: `pacaembu-vizinhos`). Pode desativar o Google Analytics.
3. No menu lateral esquerdo em **Criação**, clique em **Realtime Database**.
4. Clique em **Criar banco de dados** > Escolha a localização padrão (ex: Estados Unidos) > Avançar.
5. Em regras de segurança, selecione **Iniciar no modo de teste** (permite leitura e gravação pública) > Clique em **Ativar**.
6. Copie a URL do seu banco que aparece no topo (ex: `https://pacaembu-vizinhos-default-rtdb.firebaseio.com/`).
7. Abra o Mapa Interativo, clique no ícone de **Engrenagem ⚙️ (Configurações)** no canto superior direito:
   - Mude o modo para **Firebase Realtime Database**.
   - Cole a URL do seu banco.
   - Clique em **Salvar Configuração**.

A partir desse momento, quando qualquer vizinho se cadastrar, o terreno aparecerá **instantaneamente** na tela de todos os outros vizinhos!

---

## 📁 Estrutura de Arquivos

```text
Pacaembu/
├── index.html               # Página principal do mapa interativo
├── css/
│   └── style.css            # Estilos visuais modernos, glassmorphism e mobile-first
├── js/
│   ├── lots-data.js         # Base de dados matemática dos 988 lotes (Blocos A a U)
│   ├── storage.js           # Gerenciador de persistência (Local, Firebase e Google Sheets)
│   └── app.js               # Lógica do Leaflet, filtros, busca, modais e WhatsApp
├── assets/
│   ├── mapa.webp            # Imagem oficial de implantação otimizada para web (1.5 MB)
│   └── mapa.jpg             # Imagem de fallback JPG
├── google-apps-script.js    # Código pronto caso prefira usar uma Planilha Google
└── README.md                # Este guia explicativo
```

---

*Desenvolvido para aproximar a comunidade e facilitar a comunicação entre os futuros vizinhos!* 🏡✨
