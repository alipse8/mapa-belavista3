# Mapa Interativo dos Vizinhos - Residencial Bela Vista III (Pacaembu)

Criado por Jean da Silva Pedroso.

Mapa interativo web, responsivo para desktop e dispositivos móveis, desenvolvido a partir da planta oficial de implantação do Residencial Bela Vista III (Assis - SP). A aplicação cobre todas as 21 quadras (Blocos A a U) e os 988 lotes do empreendimento.

Hospedagem em produção via Firebase Hosting com sincronização em tempo real via Firebase Realtime Database.

- Link de acesso: https://belavista3-vizinhos.web.app

---

## Funcionalidades

- **Multi-Mapas em Alta Resolução**:
  - Mapa Minimalista: versão vetorizada e limpa com foco nos lotes e numerações.
  - Mapa de Módulos e Fases: divisão visual das 5 zonas oficiais (Fase 1 - Módulos 1, 2 e 3; Fase 2 - Módulos 1 e 2).
  - Planta Original: imagem do projeto executivo do livro de implantação.
- **Navegação por Quadras**:
  - Desktop: carrossel horizontal de blocos com seleção rápida e alternância para o mapa geral.
  - Mobile: menu suspenso integrado com botão direto de retorno ao mapa geral.
- **Busca Rápida**:
  - Localização instantânea por código de lote (ex: `B-14`, `H-02`) ou busca por nome de morador.
- **Cadastro e Identificação de Moradores**:
  - Seleção de quadra e lote.
  - Nome completo ou familiar.
  - Telefone / WhatsApp com formatação automática.
  - Situação do lote (Comprador, Pré-cadastro, Construindo, etc.).
  - Mensagem pública para a vizinhança.
- **Integração com WhatsApp**:
  - Início de conversa direto pelo card do lote, com mensagem inicial contextualizada.
- **Diretório Geral e Estatísticas**:
  - Listagem completa e pesquisável de todos os vizinhos cadastrados.
  - Painel de progresso com contagem de confirmados, pré-cadastros e ranking por bloco.
- **Sincronização em Tempo Real**:
  - Atualizações instantâneas no mapa para todos os usuários conectados via Firebase Realtime Database.
- **Exportação de Dados**:
  - Backup e download da lista de contatos em formato CSV.

---

## Estrutura do Projeto

```text
Pacaembu/
├── index.html               # Estrutura HTML da aplicação e modais
├── firebase.json            # Configurações do Firebase Hosting e Database
├── .firebaserc              # Associação com o projeto belavista3-vizinhos
├── database.rules.json      # Regras de segurança e validação do Realtime Database
├── deploy.ps1               # Script PowerShell para deploy automatizado
├── css/
│   └── style.css            # Estilos da aplicação, responsividade e layout
├── js/
│   ├── app.js               # Lógica Leaflet, eventos de interface, busca e modais
│   ├── block-capsules.js    # Coordenadas poligonais das cápsulas de cada bloco
│   ├── default-neighbors.js # Dados padrão de moradores para carga inicial
│   ├── lots-data.js         # Mapeamento de coordenadas dos 988 lotes (A a U)
│   └── storage.js           # Camada de persistência (Firebase, Sheets, LocalStorage)
└── assets/
    ├── mapa_clean.webp      # Mapa minimalista otimizado
    ├── mapa_clean.svg       # Vetor do mapa minimalista
    ├── mapa_fases.webp      # Mapa oficial com divisão de módulos e fases
    ├── mapa_fases.svg       # Vetor do mapa de fases
    └── mapa.webp            # Planta original em alta resolução
```

---

## Segurança do Banco de Dados

O banco de dados utiliza regras estritas de segurança em `database.rules.json`:

- Acesso à raiz (`/`) bloqueado para leitura e escrita direta.
- Leitura pública permitida exclusivamente no nó `/vizinhos`.
- Gravação restrita a lotes individuais (`/vizinhos/$lotId`) com validação de esquema:
  - Campos obrigatórios: `id`, `block`, `lot`, `name`.
  - Validação de tipos (bloco em letra única, lote numérico entre 1 e 100).
  - Limite de caracteres em todos os campos de texto para evitar abusos.
  - Bloqueio de campos não previstos no esquema.

---

## Publicação e Deploy

Para publicar novas versões no Firebase Hosting e atualizar as regras do banco de dados:

1. Executar o script automatizado:
   ```powershell
   .\deploy.ps1
   ```

2. Ou manualmente via Firebase CLI:
   ```powershell
   npx firebase deploy --only hosting,database
   ```
