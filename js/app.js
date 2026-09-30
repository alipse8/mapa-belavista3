/**
 * app.js - Lógica Principal do Mapa Interativo dos Vizinhos
 * Residencial Bela Vista III - Pacaembu (Blocos A a U)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado global da aplicação
  const state = {
    map: null,
    currentBlock: null,
    markers: {}, // lotId -> L.marker
    neighbors: {}, // dados do storage
    selectedLot: null,
    activeOverlay: null,
  };

  // =========================================================================
  // 1. INICIALIZAÇÃO DO MAPA LEAFLET
  // =========================================================================
  function initMap() {
    const w = MAP_DIMENSIONS.width;
    const h = MAP_DIMENSIONS.height;
    const bounds = [[0, 0], [h, w]];

    state.map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomSnap: 0.2,
      zoomDelta: 0.5,
      attributionControl: false,
      maxBounds: [[-200, -200], [h + 200, w + 200]],
      maxBoundsViscosity: 0.8
    });

    // Imagem do mapa (suporta WebP com fallback)
    const imgOverlay = L.imageOverlay('assets/mapa.webp', bounds, {
      alt: 'Mapa de Implantação Pacaembu'
    }).addTo(state.map);

    // Se o navegador não suportar WebP, fallback para JPG
    imgOverlay.on('error', () => {
      imgOverlay.setUrl('assets/mapa.jpg');
    });

    // Ajusta visão inicial para ver todo o loteamento
    state.map.fitBounds(bounds, { padding: [10, 10] });

    // Click no mapa
    state.map.on('click', (e) => {
      // Fecha dropdowns abertos
      closeSearchDropdown();
    });

    // Ao mudar o zoom, ajusta visibilidade de lotes vazios
    state.map.on('zoomend', () => {
      updateMarkersVisibility();
    });
  }

  // Converte coordenadas de pixel da imagem para Leaflet LatLng
  function pixelToLatLng(x, y) {
    return [MAP_DIMENSIONS.height - y, x];
  }

  // =========================================================================
  // 2. RENDERIZAÇÃO DOS MARCADORES DE LOTES
  // =========================================================================
  function renderAllLots() {
    // Limpa marcadores existentes
    Object.values(state.markers).forEach(m => state.map.removeLayer(m));
    state.markers = {};

    const neighbors = state.neighbors;
    const currentZoom = state.map ? state.map.getZoom() : -1;

    LOTS_DATA.forEach(lot => {
      const latlng = pixelToLatLng(lot.x, lot.y);
      const neighbor = neighbors[lot.id];
      const isOccupied = !!neighbor;

      let iconHtml = '';
      if (isOccupied) {
        const initial = (neighbor.name || 'V')[0].toUpperCase();
        iconHtml = `<div class="lot-pin-occupied" title="${neighbor.name}">${initial}</div>`;
      } else {
        iconHtml = `<div class="lot-pin-empty">${lot.lot}</div>`;
      }

      const customIcon = L.divIcon({
        className: 'lot-marker',
        html: iconHtml,
        iconSize: isOccupied ? [24, 24] : [16, 16],
        iconAnchor: isOccupied ? [12, 12] : [8, 8]
      });

      const marker = L.marker(latlng, { icon: customIcon });

      // Tooltip informativo
      const tooltipText = isOccupied
        ? `<strong>Quadra ${lot.block} • Lote ${lot.lot}</strong><br>👤 ${neighbor.name}<br>💬 Clique para ver`
        : `<strong>Quadra ${lot.block} • Lote ${lot.lot}</strong><br>Disponível • Clique para cadastrar`;

      marker.bindTooltip(tooltipText, {
        className: 'custom-tooltip',
        direction: 'top',
        offset: [0, -10]
      });

      // Evento de clique
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        handleLotClick(lot, neighbor);
      });

      state.markers[lot.id] = marker;

      // Adiciona ao mapa se estiver ocupado OU se o zoom for alto o suficiente
      const shouldShow = isOccupied || currentZoom >= -0.5 || (state.currentBlock && state.currentBlock === lot.block);
      if (shouldShow) {
        marker.addTo(state.map);
      }
    });

    updateCounters();
  }

  function updateMarkersVisibility() {
    if (!state.map) return;
    const currentZoom = state.map.getZoom();

    LOTS_DATA.forEach(lot => {
      const marker = state.markers[lot.id];
      if (!marker) return;

      const isOccupied = !!state.neighbors[lot.id];
      const isBlockFocused = state.currentBlock && state.currentBlock === lot.block;
      const shouldShow = isOccupied || currentZoom >= -0.5 || isBlockFocused;

      const isCurrentlyOnMap = state.map.hasLayer(marker);
      if (shouldShow && !isCurrentlyOnMap) {
        marker.addTo(state.map);
      } else if (!shouldShow && isCurrentlyOnMap) {
        state.map.removeLayer(marker);
      }
    });
  }

  // =========================================================================
  // 3. NAVEGADOR DE BLOCOS (CHIPS HORIZONTAIS)
  // =========================================================================
  function initBlockNavigator() {
    const container = document.getElementById('blockChipsContainer');
    if (!container) return;

    // Botão "Todos"
    const allBtn = document.createElement('button');
    allBtn.className = 'chip-btn active';
    allBtn.innerText = 'Todos';
    allBtn.onclick = () => focusBlock(null, allBtn);
    container.appendChild(allBtn);

    AVAILABLE_BLOCKS.forEach(bname => {
      const btn = document.createElement('button');
      btn.className = 'chip-btn';
      btn.innerText = `Bloco ${bname}`;
      btn.onclick = () => focusBlock(bname, btn);
      container.appendChild(btn);
    });
  }

  function focusBlock(blockName, chipElement) {
    state.currentBlock = blockName;

    // Atualiza estado visual dos chips
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
    if (chipElement) chipElement.classList.add('active');

    // Remove destaque anterior de bloco
    if (state.activeBlockBox) {
      state.map.removeLayer(state.activeBlockBox);
      state.activeBlockBox = null;
    }

    if (!blockName) {
      // Zoom em todo o loteamento
      state.map.fitBounds([[0, 0], [MAP_DIMENSIONS.height, MAP_DIMENSIONS.width]], {
        padding: [20, 20],
        animate: true,
        duration: 1
      });
      updateMarkersVisibility();
      return;
    }

    const meta = BLOCKS_METADATA[blockName];
    if (meta) {
      const p1 = pixelToLatLng(meta.x1 - 40, meta.y1 - 30);
      const p2 = pixelToLatLng(meta.x2 + 40, meta.y2 + 30);
      const blockBounds = L.latLngBounds(p1, p2);

      // Desenha retângulo suave destacando o bloco
      state.activeBlockBox = L.rectangle(blockBounds, {
        color: '#0284c7',
        weight: 2,
        fillColor: '#0284c7',
        fillOpacity: 0.08,
        dashArray: '6, 6'
      }).addTo(state.map);

      state.map.fitBounds(blockBounds, {
        padding: [50, 50],
        animate: true,
        duration: 0.8
      });

      updateMarkersVisibility();
    }
  }

  // =========================================================================
  // 4. INTERAÇÃO E CLIQUES NOS LOTES
  // =========================================================================
  function handleLotClick(lot, neighbor) {
    state.selectedLot = lot;
    if (neighbor) {
      showNeighborProfileModal(neighbor, lot);
    } else {
      openRegisterModal(lot.block, lot.lot);
    }
  }

  function focusLotOnMap(lotId) {
    const lot = LOTS_BY_ID[lotId];
    if (!lot || !state.map) return;

    const latlng = pixelToLatLng(lot.x, lot.y);
    state.map.setView(latlng, 1, { animate: true, duration: 0.8 });

    const marker = state.markers[lotId];
    if (marker) {
      if (!state.map.hasLayer(marker)) {
        marker.addTo(state.map);
      }
      marker.openTooltip();
    }
  }

  // =========================================================================
  // 5. MODAIS & FORMULÁRIOS
  // =========================================================================
  // Modal de Cadastro
  function openRegisterModal(prefillBlock = 'A', prefillLot = 1) {
    const modal = document.getElementById('registerModal');
    const blockSelect = document.getElementById('regBlock');
    const lotSelect = document.getElementById('regLot');
    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const statusSelect = document.getElementById('regStatus');
    const messageInput = document.getElementById('regMessage');

    // Popula blocos
    blockSelect.innerHTML = AVAILABLE_BLOCKS.map(b => `<option value="${b}">Bloco ${b}</option>`).join('');
    blockSelect.value = prefillBlock;

    // Popula lotes daquele bloco
    updateLotSelectOptions(prefillBlock, prefillLot);

    blockSelect.onchange = () => {
      updateLotSelectOptions(blockSelect.value, 1);
    };

    // Limpa campos
    nameInput.value = '';
    phoneInput.value = '';
    statusSelect.value = 'Em obras';
    messageInput.value = '';

    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 150);
  }

  function updateLotSelectOptions(blockName, selectedLot = 1) {
    const lotSelect = document.getElementById('regLot');
    const lotsOfBlock = LOTS_DATA.filter(l => l.block === blockName);
    lotSelect.innerHTML = lotsOfBlock.map(l => {
      const isOcc = !!state.neighbors[l.id];
      return `<option value="${l.lot}">${l.lot} ${isOcc ? '(Ocupado - Atualizar)' : ''}</option>`;
    }).join('');
    lotSelect.value = selectedLot;
  }

  function closeRegisterModal() {
    document.getElementById('registerModal').classList.remove('active');
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const block = document.getElementById('regBlock').value;
    const lot = parseInt(document.getElementById('regLot').value, 10);
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const status = document.getElementById('regStatus').value;
    const message = document.getElementById('regMessage').value.trim();

    if (!name) {
      alert('Por favor, informe seu nome.');
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      alert('Por favor, informe um WhatsApp válido com DDD (Ex: 11 98888-8888).');
      return;
    }

    const lotId = `${block}-${String(lot).padStart(2, '0')}`;
    const submitBtn = document.getElementById('btnSubmitRegister');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Salvando...';

    try {
      await window.storage.saveLot(lotId, {
        block,
        lot,
        name,
        phone,
        status,
        message
      });

      showToast(`Lote ${lotId} cadastrado com sucesso! 🎉`);
      closeRegisterModal();
      focusLotOnMap(lotId);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar lote. Verifique sua conexão.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Salvar e Compartilhar';
    }
  }

  // Modal de Perfil do Vizinho
  function showNeighborProfileModal(neighbor, lot) {
    const modal = document.getElementById('neighborModal');
    const avatar = document.getElementById('neighborAvatar');
    const nameEl = document.getElementById('neighborName');
    const locationEl = document.getElementById('neighborLocation');
    const statusEl = document.getElementById('neighborStatus');
    const messageBox = document.getElementById('neighborMessageBox');
    const whatsappBtn = document.getElementById('neighborWhatsappBtn');
    const deleteBtn = document.getElementById('btnDeleteLot');

    const initial = (neighbor.name || 'V')[0].toUpperCase();
    avatar.innerText = initial;
    nameEl.innerText = neighbor.name;
    locationEl.innerText = `Quadra / Bloco ${neighbor.block} • Lote ${neighbor.lot} (${lot.phase || 'Residencial'})`;
    statusEl.innerText = neighbor.status || 'Comprador';

    if (neighbor.message) {
      messageBox.style.display = 'block';
      messageBox.innerText = `"${neighbor.message}"`;
    } else {
      messageBox.style.display = 'none';
    }

    // Configura link do WhatsApp com mensagem amigável
    const cleanPhone = neighbor.phone.replace(/\D/g, '');
    const prefilledText = encodeURIComponent(
      `Olá ${neighbor.name}! Sou seu vizinho do Residencial Pacaembu (Bloco/Lote). Vi seu contato no Mapa Interativo!`
    );
    whatsappBtn.href = `https://wa.me/55${cleanPhone}?text=${prefilledText}`;

    // Ação de excluir / editar
    deleteBtn.onclick = async () => {
      if (confirm(`Deseja realmente remover o cadastro de ${neighbor.name} no Lote ${neighbor.id}?`)) {
        await window.storage.deleteLot(neighbor.id);
        showToast('Lote desocupado com sucesso.');
        modal.classList.remove('active');
      }
    };

    modal.classList.add('active');
  }

  function closeNeighborModal() {
    document.getElementById('neighborModal').classList.remove('active');
  }

  // =========================================================================
  // 6. DIRETÓRIO DE VIZINHOS (DRAWER)
  // =========================================================================
  function openDirectoryModal() {
    renderDirectoryList();
    document.getElementById('directoryModal').classList.add('active');
  }

  function closeDirectoryModal() {
    document.getElementById('directoryModal').classList.remove('active');
  }

  function renderDirectoryList(filterText = '') {
    const container = document.getElementById('directoryList');
    if (!container) return;

    const items = Object.values(state.neighbors);
    const query = filterText.toLowerCase().trim();

    const filtered = items.filter(n => {
      const matchName = n.name && n.name.toLowerCase().includes(query);
      const matchLot = n.id && n.id.toLowerCase().includes(query);
      const matchBlock = n.block && `bloco ${n.block}`.toLowerCase().includes(query);
      return matchName || matchLot || matchBlock;
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--gray-500);">
          <p style="font-size: 24px; margin-bottom: 8px;">🔍</p>
          <p>Nenhum vizinho encontrado com esse termo.</p>
        </div>
      `;
      return;
    }

    // Ordena por Bloco e Lote
    filtered.sort((a, b) => a.block.localeCompare(b.block) || a.lot - b.lot);

    container.innerHTML = filtered.map(n => {
      const cleanPhone = n.phone ? n.phone.replace(/\D/g, '') : '';
      const whatsappLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${n.name}! Sou seu vizinho no Residencial Pacaembu!`)}`;
      return `
        <div class="directory-card">
          <div class="directory-card-info">
            <h5>
              ${n.name}
              <span class="neighbor-status-badge" style="font-size: 10px;">${n.status || 'Vizinho'}</span>
            </h5>
            <p>📍 Bloco ${n.block} • Lote ${n.lot} ${n.message ? '• "' + n.message + '"' : ''}</p>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-secondary" style="height: 34px; padding: 0 10px; font-size: 12px;" onclick="window.app.locateAndShow('${n.id}')">
              Ver no Mapa
            </button>
            <a class="btn-whatsapp" style="height: 34px; width: 34px; padding: 0; border-radius: var(--radius-sm);" href="${whatsappLink}" target="_blank" title="Chamar no WhatsApp">
              💬
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // 7. BUSCA RÁPIDA NO HEADER
  // =========================================================================
  function initHeaderSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    const clearBtn = document.getElementById('searchClear');

    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      if (!query) {
        closeSearchDropdown();
        clearBtn.style.display = 'none';
        return;
      }

      clearBtn.style.display = 'block';

      // Busca por lote (ex: 'B-14', 'bloco b', '14') ou por nome de vizinho
      const results = LOTS_DATA.filter(l => {
        const neighbor = state.neighbors[l.id];
        const matchId = l.id.toLowerCase().includes(query);
        const matchBlock = `bloco ${l.block}`.toLowerCase().includes(query) || `quadra ${l.block}`.toLowerCase().includes(query);
        const matchName = neighbor && neighbor.name.toLowerCase().includes(query);
        return matchId || matchBlock || matchName;
      }).slice(0, 15);

      if (!results.length) {
        dropdown.innerHTML = `<div style="padding: 12px; font-size: 12px; color: var(--gray-500); text-align: center;">Nenhum lote ou vizinho encontrado</div>`;
      } else {
        dropdown.innerHTML = results.map(l => {
          const neighbor = state.neighbors[l.id];
          const isOcc = !!neighbor;
          return `
            <div class="search-item" onclick="window.app.selectSearchItem('${l.id}')">
              <div>
                <div class="search-item-title">Quadra / Bloco ${l.block} • Lote ${l.lot}</div>
                <div class="search-item-sub">${isOcc ? '👤 ' + neighbor.name : 'Terreno disponível'}</div>
              </div>
              <span class="search-item-badge ${isOcc ? 'occupied' : ''}">
                ${isOcc ? 'Cadastrado' : 'Disponível'}
              </span>
            </div>
          `;
        }).join('');
      }

      dropdown.classList.add('active');
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      closeSearchDropdown();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header-search')) {
        closeSearchDropdown();
      }
    });
  }

  function closeSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.classList.remove('active');
  }

  // =========================================================================
  // 8. ESTATÍSTICAS
  // =========================================================================
  function updateCounters() {
    const totalLots = LOTS_DATA.length;
    const occupiedCount = Object.keys(state.neighbors).length;
    const percent = ((occupiedCount / totalLots) * 100).toFixed(1);

    const countEls = document.querySelectorAll('.stat-occupied-count');
    countEls.forEach(el => el.innerText = occupiedCount);

    const totalEls = document.querySelectorAll('.stat-total-count');
    totalEls.forEach(el => el.innerText = totalLots);

    const percentEls = document.querySelectorAll('.stat-percent-count');
    percentEls.forEach(el => el.innerText = `${percent}%`);
  }

  function openStatsModal() {
    updateCounters();
    const container = document.getElementById('blockStatsList');
    if (container) {
      // Ranking de quadras
      const blockCounts = {};
      AVAILABLE_BLOCKS.forEach(b => blockCounts[b] = 0);
      Object.values(state.neighbors).forEach(n => {
        if (blockCounts[n.block] !== undefined) blockCounts[n.block]++;
      });

      const sortedBlocks = Object.entries(blockCounts).sort((a, b) => b[1] - a[1]);

      container.innerHTML = sortedBlocks.map(([b, count]) => {
        const total = LOTS_DATA.filter(l => l.block === b).length;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
              <span><strong>Bloco ${b}</strong>: ${count} de ${total} vizinhos</span>
              <span>${pct}%</span>
            </div>
            <div style="height: 6px; background: var(--gray-200); border-radius: var(--radius-full); overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: var(--primary);"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('statsModal').classList.add('active');
  }

  function closeStatsModal() {
    document.getElementById('statsModal').classList.remove('active');
  }

  // =========================================================================
  // 9. CONFIGURAÇÕES & SINCRONIZAÇÃO NUVEM
  // =========================================================================
  function openConfigModal() {
    const modal = document.getElementById('configModal');
    const modeSelect = document.getElementById('configStorageMode');
    const fbUrlInput = document.getElementById('configFbUrl');
    const sheetsUrlInput = document.getElementById('configSheetsUrl');

    modeSelect.value = window.storage.config.mode || 'local';
    fbUrlInput.value = window.storage.config.firebase ? window.storage.config.firebase.databaseURL : '';
    sheetsUrlInput.value = window.storage.config.sheetsUrl || '';

    toggleConfigFields(modeSelect.value);
    modeSelect.onchange = () => toggleConfigFields(modeSelect.value);

    modal.classList.add('active');
  }

  function toggleConfigFields(mode) {
    document.getElementById('firebaseConfigFields').style.display = mode === 'firebase' ? 'block' : 'none';
    document.getElementById('sheetsConfigFields').style.display = mode === 'sheets' ? 'block' : 'none';
  }

  function closeConfigModal() {
    document.getElementById('configModal').classList.remove('active');
  }

  function saveConfigFromModal() {
    const mode = document.getElementById('configStorageMode').value;
    const fbUrl = document.getElementById('configFbUrl').value.trim();
    const sheetsUrl = document.getElementById('configSheetsUrl').value.trim();

    window.storage.saveConfig({
      mode,
      firebase: {
        databaseURL: fbUrl
      },
      sheetsUrl
    });

    showToast('Configurações salvas!');
    closeConfigModal();
  }

  // =========================================================================
  // 10. COMPARTILHAMENTO & TOASTS
  // =========================================================================
  function shareMap() {
    const text = '🏠 Encontre seus vizinhos no Mapa Interativo do Residencial Bela Vista III (Pacaembu)! Cadastre seu lote: ' + window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Mapa dos Vizinhos - Residencial Pacaembu',
        text: text,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Link copiado para a área de transferência! 📋');
      });
    }
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Máscara de telefone brasileiro
  function setupPhoneMask(input) {
    input.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        v = `(${v}`;
      }
      e.target.value = v;
    });
  }

  // =========================================================================
  // 11. INICIALIZAÇÃO E BINDINGS
  // =========================================================================
  initMap();
  initBlockNavigator();
  initHeaderSearch();

  const phoneInput = document.getElementById('regPhone');
  if (phoneInput) setupPhoneMask(phoneInput);

  // Escuta dados do Storage (local ou nuvem)
  window.storage.subscribe((data) => {
    state.neighbors = data || {};
    renderAllLots();
    if (document.getElementById('directoryModal').classList.contains('active')) {
      renderDirectoryList();
    }
  });

  window.storage.init();

  // Exposição de métodos para botões inline
  window.app = {
    openRegisterModal,
    closeRegisterModal,
    closeNeighborModal,
    openDirectoryModal,
    closeDirectoryModal,
    openStatsModal,
    closeStatsModal,
    openConfigModal,
    closeConfigModal,
    saveConfigFromModal,
    shareMap,
    locateAndShow: (lotId) => {
      closeDirectoryModal();
      focusLotOnMap(lotId);
      const neighbor = state.neighbors[lotId];
      const lot = LOTS_BY_ID[lotId];
      if (neighbor && lot) {
        setTimeout(() => showNeighborProfileModal(neighbor, lot), 400);
      }
    },
    selectSearchItem: (lotId) => {
      closeSearchDropdown();
      focusLotOnMap(lotId);
      const neighbor = state.neighbors[lotId];
      const lot = LOTS_BY_ID[lotId];
      if (neighbor && lot) {
        setTimeout(() => showNeighborProfileModal(neighbor, lot), 400);
      } else if (lot) {
        setTimeout(() => openRegisterModal(lot.block, lot.lot), 400);
      }
    }
  };

  // Bind do formulário de cadastro
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.onsubmit = handleRegisterSubmit;

  // Busca do diretório
  const dirSearch = document.getElementById('directorySearchInput');
  if (dirSearch) {
    dirSearch.addEventListener('input', (e) => {
      renderDirectoryList(e.target.value);
    });
  }
});
