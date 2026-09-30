# 🏡 Mapa Interativo dos Vizinhos • Residencial Bela Vista III (Pacaembu)

Um mapa interativo completo e responsivo (otimizado para celular e computador) desenvolvido a partir da planta oficial de implantação (Página 21 do Book do Corretor), cobrindo **todas as 21 quadras (Blocos A a U)** e **988 lotes residenciais**.

Hospedado no **Firebase Hosting** com banco de dados em tempo real no **Firebase Realtime Database** (`belavista3-vizinhos-default-rtdb`).

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
- ☁️ **Sincronização em Tempo Real (Firebase)**: Quando qualquer morador cadastra um lote, ele aparece instantaneamente para todos os vizinhos conectados!
- 📥 **Exportação Excel / CSV**: Baixe a lista de contatos em planilha a qualquer momento.

---

## 🚀 Como Publicar no Firebase Hosting

O projeto já está 100% configurado para o seu projeto `belavista3-vizinhos`.

### Passo 1: Fazer login no Firebase (caso ainda não tenha feito)
No terminal PowerShell nesta pasta, execute:
```powershell
npx firebase login
```
*(Ele abrirá seu navegador para você confirmar sua conta Google)*

### Passo 2: Fazer o Deploy do Site
Execute o comando:
```powershell
npx firebase deploy --only hosting
```

Pronto! Seu mapa interativo estará publicado e acessível publicamente nos endereços:
- 🌐 `https://belavista3-vizinhos.web.app`
- 🌐 `https://belavista3-vizinhos.firebaseapp.com`

---

## 🔒 Regras de Leitura e Gravação do Banco (Realtime Database)

Para que os vizinhos consigam cadastrar seus lotes sem erro de permissão:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/) > Seu projeto `belavista3-vizinhos`.
2. No menu lateral esquerdo, clique em **Realtime Database**.
3. Clique na aba **Regras** (Rules) no topo.
4. Garanta que as regras estejam assim:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
5. Clique em **Publicar** (Publish).

---

## 📁 Estrutura de Arquivos

```text
Pacaembu/
├── index.html               # Página principal do mapa interativo
├── firebase.json            # Configuração do Firebase Hosting e Database
├── .firebaserc              # Aponta para o projeto belavista3-vizinhos
├── database.rules.json      # Regras de acesso público do banco de dados
├── css/
│   └── style.css            # Estilos visuais modernos, glassmorphism e mobile-first
├── js/
│   ├── lots-data.js         # Base de dados matemática dos 988 lotes (Blocos A a U)
│   ├── storage.js           # Gerenciador com Firebase Realtime Database pré-configurado
│   └── app.js               # Lógica do Leaflet, filtros, busca, modais e WhatsApp
├── assets/
│   ├── mapa.webp            # Imagem oficial de implantação otimizada para web (1.5 MB)
│   └── mapa.jpg             # Imagem de fallback JPG
└── README.md                # Este guia explicativo
```
