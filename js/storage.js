/**
 * storage.js - Camada de Persistência e Sincronização em Tempo Real
 * Suporta:
 * 1. Firebase Realtime Database (Sincronização instantânea na nuvem para todos os vizinhos)
 * 2. Google Sheets Webhook (Opcional via Google Apps Script)
 * 3. LocalStorage (Modo offline / Demonstração com persistência local)
 */

class LotStorage {
  constructor() {
    this.storageKey = 'pacaembu_vizinhos_v1';
    this.configKey = 'pacaembu_config_v1';
    this.subscribers = [];
    this.cache = {};
    this.firebaseApp = null;
    this.firebaseDb = null;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de storage:', e);
    }
    return {
      mode: 'local', // 'local' | 'firebase' | 'sheets'
      firebase: {
        databaseURL: '',
        apiKey: '',
        projectId: ''
      },
      sheetsUrl: ''
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(this.configKey, JSON.stringify(this.config));
    } catch (e) {
      console.error('Erro ao salvar config:', e);
    }
    this.init();
  }

  async init() {
    // 1. Carrega dados do LocalStorage como fallback inicial
    this.loadFromLocal();

    // 2. Se configurado Firebase, inicializa sincronização em tempo real
    if (this.config.mode === 'firebase' && this.config.firebase && this.config.firebase.databaseURL) {
      this.initFirebase();
    } else if (this.config.mode === 'sheets' && this.config.sheetsUrl) {
      this.syncFromSheets();
    } else {
      this.notifySubscribers();
    }
  }

  loadFromLocal() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.cache = JSON.parse(data);
      } else {
        // Se nunca foi aberto, carrega os exemplos iniciais
        this.cache = { ...INITIAL_DEMO_NEIGHBORS };
        this.saveToLocal();
      }
    } catch (e) {
      console.error('Erro ao ler LocalStorage:', e);
      this.cache = { ...INITIAL_DEMO_NEIGHBORS };
    }
  }

  saveToLocal() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cache));
    } catch (e) {
      console.error('Erro ao gravar no LocalStorage:', e);
    }
  }

  // --- FIREBASE REALTIME DATABASE ---
  initFirebase() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Biblioteca Firebase não carregada. Operando em modo local.');
        return;
      }

      const fbConfig = {
        databaseURL: this.config.firebase.databaseURL,
        apiKey: this.config.firebase.apiKey || 'dummy-key',
        projectId: this.config.firebase.projectId || 'pacaembu-mapa'
      };

      if (!firebase.apps.length) {
        this.firebaseApp = firebase.initializeApp(fbConfig);
      } else {
        this.firebaseApp = firebase.app();
      }

      this.firebaseDb = firebase.database();
      const lotsRef = this.firebaseDb.ref('vizinhos');

      // Escuta mudanças em tempo real!
      lotsRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          this.cache = val;
        } else {
          this.cache = {};
        }
        this.saveToLocal(); // mantém cópia local
        this.notifySubscribers();
      }, (error) => {
        console.error('Erro ao sincronizar Firebase:', error);
      });

      console.log('Firebase Realtime Database conectado com sucesso!');
    } catch (e) {
      console.error('Falha ao inicializar Firebase:', e);
    }
  }

  // --- GOOGLE SHEETS WEBHOOK ---
  async syncFromSheets() {
    if (!this.config.sheetsUrl) return;
    try {
      const res = await fetch(this.config.sheetsUrl + '?action=get');
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') {
          this.cache = json;
          this.saveToLocal();
          this.notifySubscribers();
        }
      }
    } catch (e) {
      console.warn('Erro ao sincronizar com Google Sheets:', e);
    }
  }

  // --- OPERAÇÕES CRUD ---
  async saveLot(lotId, data) {
    const record = {
      id: lotId,
      block: data.block,
      lot: Number(data.lot),
      name: data.name.trim(),
      phone: data.phone.replace(/\D/g, ''),
      phoneFormatted: data.phone,
      status: data.status || 'Comprador',
      message: data.message ? data.message.trim() : '',
      registeredAt: data.registeredAt || new Date().toISOString()
    };

    // Atualiza cache local
    this.cache[lotId] = record;
    this.saveToLocal();
    this.notifySubscribers();

    // Sincroniza nuvem se ativo
    if (this.config.mode === 'firebase' && this.firebaseDb) {
      try {
        await this.firebaseDb.ref(`vizinhos/${lotId}`).set(record);
      } catch (e) {
        console.error('Erro ao salvar no Firebase:', e);
        throw e;
      }
    } else if (this.config.mode === 'sheets' && this.config.sheetsUrl) {
      try {
        await fetch(this.config.sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', lot: record })
        });
      } catch (e) {
        console.warn('Erro ao enviar para Google Sheets:', e);
      }
    }

    return record;
  }

  async deleteLot(lotId) {
    delete this.cache[lotId];
    this.saveToLocal();
    this.notifySubscribers();

    if (this.config.mode === 'firebase' && this.firebaseDb) {
      try {
        await this.firebaseDb.ref(`vizinhos/${lotId}`).remove();
      } catch (e) {
        console.error('Erro ao remover do Firebase:', e);
      }
    } else if (this.config.mode === 'sheets' && this.config.sheetsUrl) {
      try {
        await fetch(this.config.sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: lotId })
        });
      } catch (e) {
        console.warn('Erro ao deletar no Google Sheets:', e);
      }
    }
  }

  getLot(lotId) {
    return this.cache[lotId] || null;
  }

  getAll() {
    return this.cache;
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    // Dispara imediatamente com o cache atual
    callback(this.cache);
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => {
      try {
        cb(this.cache);
      } catch (e) {
        console.error('Erro no listener de storage:', e);
      }
    });
  }

  // --- EXPORTAÇÃO E IMPORTAÇÃO ---
  exportCSV() {
    const items = Object.values(this.cache);
    if (!items.length) return '';

    const headers = ['ID', 'Quadra/Bloco', 'Lote', 'Nome', 'Telefone', 'Status', 'Mensagem', 'Data Cadastro'];
    const rows = items.map(item => [
      `"${item.id}"`,
      `"${item.block}"`,
      item.lot,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${item.phone || ''}"`,
      `"${(item.status || '').replace(/"/g, '""')}"`,
      `"${(item.message || '').replace(/"/g, '""')}"`,
      `"${item.registeredAt || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    return csvContent;
  }

  downloadCSV() {
    const csv = this.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vizinhos_pacaembu_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  exportJSON() {
    return JSON.stringify(this.cache, null, 2);
  }

  downloadJSON() {
    const json = this.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vizinhos_pacaembu_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.cache = { ...this.cache, ...parsed };
        this.saveToLocal();
        this.notifySubscribers();
        return true;
      }
    } catch (e) {
      console.error('Falha ao importar JSON:', e);
    }
    return false;
  }
}

// Instância singleton global
window.storage = new LotStorage();
