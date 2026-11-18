/**
 * storage.js - Camada de Persistência e Sincronização em Tempo Real
 * Suporta:
 * 1. Firebase Realtime Database (Configurado para belavista3-vizinhos)
 * 2. Google Sheets Webhook (Opcional via Google Apps Script)
 * 3. LocalStorage (Fallback e cache local)
 */

class LotStorage {
  constructor() {
    this.storageKey = 'pacaembu_vizinhos_v2';
    this.localOverridesKey = 'pacaembu_vizinhos_local_dev';
    this.configKey = 'pacaembu_config_v2';
    this.isLocalEnv = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
    this.subscribers = [];
    this.cache = {};
    this.firebaseApp = null;
    this.firebaseDb = null;
    this.config = this.loadConfig();

    if (this.isLocalEnv) {
      console.info('[Modo Local] Proteção ativa: leitura do Firebase liberada, mas gravações/exclusões ficam isoladas no navegador.');
    }
  }

  loadConfig() {
    const defaultConfig = {
      mode: 'firebase', // Padrão: Firebase Realtime Database ativo
      firebase: {
        databaseURL: 'https://belavista3-vizinhos-default-rtdb.firebaseio.com/',
        apiKey: '',
        projectId: 'belavista3-vizinhos'
      },
      sheetsUrl: ''
    };

    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Garante que o databaseURL seja o do usuário se estiver vazio
        if (!parsed.firebase || !parsed.firebase.databaseURL) {
          parsed.firebase = defaultConfig.firebase;
          parsed.mode = 'firebase';
        }
        return { ...defaultConfig, ...parsed };
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de storage:', e);
    }
    return defaultConfig;
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

  /**
   * Retorna alterações feitas em ambiente local para mesclar sem tocar no Firebase.
   */
  getLocalOverrides() {
    try {
      const raw = localStorage.getItem(this.localOverridesKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Erro ao ler overrides locais:', e);
      return {};
    }
  }

  /**
   * Salva uma alteração ou remoção (null) apenas no armazenamento local de desenvolvimento.
   */
  saveLocalOverride(lotId, recordOrNull) {
    try {
      const overrides = this.getLocalOverrides();
      overrides[lotId] = recordOrNull;
      localStorage.setItem(this.localOverridesKey, JSON.stringify(overrides));
    } catch (e) {
      console.error('Erro ao gravar override local:', e);
    }
  }

  /**
   * Aplica alterações locais sobre os dados vindos do banco de produção.
   */
  applyLocalOverrides(baseData) {
    const merged = { ...(baseData || {}), ...this.getLocalOverrides() };
    Object.keys(merged).forEach((key) => {
      if (merged[key] === null) delete merged[key];
    });
    return merged;
  }

  /**
   * Remove registros da antiga lista de pré-cadastro sem telefone confirmado.
   */
  filterOutPreCadastros(records) {
    const cleaned = {};
    Object.keys(records || {}).forEach((key) => {
      const n = records[key];
      if (!n) return;
      const cleanPhone = (n.phone || '').replace(/\D/g, '');
      const isPre =
        n.isPreCadastro === true ||
        (n.isPreCadastro !== false && cleanPhone.length < 8 && (!n.registeredAt || n.registeredAt === '2026-09-30T18:00:00.000Z'));
      if (!isPre) {
        cleaned[key] = n;
      }
    });
    return cleaned;
  }

  loadFromLocal() {
    try {
      localStorage.removeItem('pacaembu_vizinhos_v1');
      const data = localStorage.getItem(this.storageKey);
      const defaults = (typeof DEFAULT_NEIGHBORS !== 'undefined') ? DEFAULT_NEIGHBORS : {};
      let merged = data ? { ...defaults, ...JSON.parse(data) } : { ...defaults };
      merged = this.filterOutPreCadastros(merged);
      if (this.isLocalEnv) {
        merged = this.applyLocalOverrides(merged);
      }
      this.cache = merged;
    } catch (e) {
      console.error('Erro ao ler LocalStorage:', e);
      this.cache = this.filterOutPreCadastros((typeof DEFAULT_NEIGHBORS !== 'undefined') ? { ...DEFAULT_NEIGHBORS } : {});
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
        this.notifySubscribers();
        return;
      }

      const fbConfig = {
        databaseURL: this.config.firebase.databaseURL,
        apiKey: this.config.firebase.apiKey || 'AIzaSyDemoKeyForPublicDatabase123',
        projectId: this.config.firebase.projectId || 'belavista3-vizinhos'
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
        const remoteData = val ? this.filterOutPreCadastros(val) : {};
        this.cache = this.isLocalEnv ? this.applyLocalOverrides(remoteData) : remoteData;
        this.saveToLocal(); // mantém cópia local
        this.notifySubscribers();
      }, (error) => {
        console.warn('Aviso do Firebase (verifique as Regras de Leitura/Gravação no Console):', error);
        // Fallback para cache local se houver restrição
        this.notifySubscribers();
      });

      console.log('Firebase conectado a:', this.config.firebase.databaseURL);
    } catch (e) {
      console.error('Falha ao inicializar Firebase:', e);
      this.notifySubscribers();
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

    // Atualiza cache local imediatamente para resposta rápida na UI
    this.cache[lotId] = record;
    this.saveToLocal();
    this.notifySubscribers();

    // Em ambiente local, protege o banco de produção gravando apenas no localStorage
    if (this.isLocalEnv) {
      this.saveLocalOverride(lotId, record);
      console.info(`[Modo Local] Lote ${lotId} salvo apenas localmente (${this.localOverridesKey}). Firebase de produção protegido.`);
      return record;
    }

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

    // Em ambiente local, protege o banco de produção removendo apenas no localStorage
    if (this.isLocalEnv) {
      this.saveLocalOverride(lotId, null);
      console.info(`[Modo Local] Lote ${lotId} removido apenas localmente (${this.localOverridesKey}). Firebase de produção protegido.`);
      return;
    }

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

    const headers = ['ID', 'Bloco', 'Lote', 'Nome', 'Telefone', 'Status', 'Mensagem', 'Data Cadastro'];
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
