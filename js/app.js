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
    activeBlockMask: null,
    isEditing: false,
    editingLotId: null,
    mapMode: 'clean', // 'clean' ou 'original'
    imgOverlay: null,
  };

  const AVAILABLE_BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

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

    // Imagem do mapa minimalista limpo (sem árvores, áreas verdes ou linhas vermelhas)
    state.imgOverlay = L.imageOverlay('assets/mapa_clean.webp', bounds, {
      alt: 'Mapa Minimalista Pacaembu'
    }).addTo(state.map);

    // Fallback caso mapa_clean não esteja disponível
    state.imgOverlay.on('error', () => {
      state.imgOverlay.setUrl('assets/mapa.webp');
    });

    // Ajusta visão inicial para ver todo o loteamento
    state.map.fitBounds(bounds, { padding: [10, 10] });

    // Click no mapa fecha buscas
    state.map.on('click', () => {
      closeSearchDropdown();
    });

    // Ao mudar o zoom, atualiza visibilidade
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
  // Helper para identificar se o lote é pré-cadastro (lista preliminar) ou confirmado/atualizado
  function isPreCadastro(neighbor) {
    if (!neighbor) return false;
    if (neighbor.isPreCadastro === false) return false;
    if (neighbor.isPreCadastro === true) return true;
    const cleanPhone = (neighbor.phone || '').replace(/\D/g, '');
    if (cleanPhone.length >= 8) return false;
    if (neighbor.registeredAt && neighbor.registeredAt !== '2026-09-30T18:00:00.000Z') return false;
    return true;
  }

  function renderAllLots() {
    // Limpa marcadores existentes
    Object.values(state.markers).forEach(m => state.map.removeLayer(m));
    state.markers = {};

    const neighbors = state.neighbors;

    LOTS_DATA.forEach(lot => {
      const latlng = pixelToLatLng(lot.x, lot.y);
      const neighbor = neighbors[lot.id];
      const isOccupied = !!neighbor;
      const isPre = isOccupied && isPreCadastro(neighbor);

      let iconHtml = '';
      if (isOccupied) {
        const initial = (neighbor.name || 'V')[0].toUpperCase();
        const badgeClass = isPre ? 'lot-pin-occupied pre-cadastro' : 'lot-pin-occupied confirmed';
        const statusTitle = isPre ? 'Pré-cadastro' : 'Confirmado';
        iconHtml = `<div class="${badgeClass}" title="${neighbor.name} (${statusTitle})">${initial}</div>`;
      } else {
        iconHtml = `<div class="lot-pin-empty" title="Lote ${lot.lot}"></div>`;
      }

      const customIcon = L.divIcon({
        className: 'lot-marker',
        html: iconHtml,
        iconSize: isOccupied ? [24, 24] : [28, 28],
        iconAnchor: isOccupied ? [12, 12] : [14, 14]
      });

      const marker = L.marker(latlng, { icon: customIcon });

      // Tooltip informativo
      const tooltipText = isOccupied
        ? `<strong>Bloco ${lot.block} • Lote ${lot.lot}</strong><br>👤 ${neighbor.name}<br>💬 Clique para ver dados`
        : `<strong>Bloco ${lot.block} • Lote ${lot.lot}</strong><br>Clique para cadastrar`;

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

      // REGRA DE VISIBILIDADE:
      // Se um bloco estiver focado, mostra todos os lotes desse bloco.
      // Se estiver no mapa geral, mostra APENAS os lotes ocupados para manter o mapa limpo e bonito!
      const isBlockFocused = state.currentBlock && state.currentBlock === lot.block;
      const shouldShow = isOccupied || isBlockFocused;
      if (shouldShow) {
        marker.addTo(state.map);
      }
    });

    updateCounters();
  }

  function updateMarkersVisibility() {
    if (!state.map) return;

    LOTS_DATA.forEach(lot => {
      const marker = state.markers[lot.id];
      if (!marker) return;

      const isOccupied = !!state.neighbors[lot.id];
      let shouldShow = false;

      if (state.currentBlock) {
        // Quando um bloco está em foco, mostra EXCLUSIVAMENTE os lotes deste bloco
        shouldShow = (state.currentBlock === lot.block);
      } else {
        // No mapa geral, mostra apenas os lotes com vizinhos cadastrados
        shouldShow = isOccupied;
      }

      const isCurrentlyOnMap = state.map.hasLayer(marker);
      if (shouldShow && !isCurrentlyOnMap) {
        marker.addTo(state.map);
      } else if (!shouldShow && isCurrentlyOnMap) {
        state.map.removeLayer(marker);
      }
    });
  }

  // =========================================================================
  // 3. NAVEGADOR DE BLOCOS (CHIPS HORIZONTAIS COM CARROSSEL)
  // =========================================================================
  function initBlockNavigator() {
    const container = document.getElementById('blockChipsContainer');
    if (!container) return;

    container.innerHTML = '';

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

  function scrollBlocks(direction) {
    const container = document.getElementById('blockChipsContainer');
    if (!container) return;
    container.scrollBy({ left: 240 * direction, behavior: 'smooth' });
  }

  function focusBlock(blockName, chipElement) {
    state.currentBlock = blockName;

    // Atualiza estado visual dos chips
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
    if (chipElement) {
      chipElement.classList.add('active');
      chipElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      const buttons = document.querySelectorAll('.chip-btn');
      buttons.forEach(btn => {
        if (!blockName && btn.innerText === 'Todos') btn.classList.add('active');
        if (blockName && btn.innerText === `Bloco ${blockName}`) {
          btn.classList.add('active');
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    }

    // Remove máscara anterior de foco
    if (state.activeBlockMask) {
      state.map.removeLayer(state.activeBlockMask);
      state.activeBlockMask = null;
    }

    const banner = document.getElementById('blockFocusBanner');
    const tray = document.getElementById('blockLotsTray');
    const genControl = document.getElementById('mapGeneralControl');

    if (!blockName) {
      // Modo Mapa Geral: esconde banner e bandeja, reexibe controle geral e FAB
      if (banner) banner.style.display = 'none';
      if (tray) tray.style.display = 'none';
      if (genControl) genControl.style.display = 'flex';
      const fab = document.querySelector('.fab-container');
      if (fab) fab.style.display = 'flex';

      // Zoom em todo o loteamento
      state.map.fitBounds([[0, 0], [MAP_DIMENSIONS.height, MAP_DIMENSIONS.width]], {
        padding: [20, 20],
        animate: true,
        duration: 0.8
      });
      updateMarkersVisibility();
      return;
    }

    const capsulePts = (typeof BLOCK_CAPSULES !== 'undefined' && BLOCK_CAPSULES[blockName]) ? BLOCK_CAPSULES[blockName] : null;
    const meta = BLOCKS_METADATA[blockName];

    if (capsulePts) {
      // Converte coordenadas da cápsula exata do bloco para LatLng
      const innerRing = capsulePts.map(([x, y]) => pixelToLatLng(x, y));
      const outerRing = [
        [-5000, -5000],
        [MAP_DIMENSIONS.height + 5000, -5000],
        [MAP_DIMENSIONS.height + 5000, MAP_DIMENSIONS.width + 5000],
        [-5000, MAP_DIMENSIONS.width + 5000]
      ];

      // Máscara com recorte preciso na borda da cápsula do bloco: SOMENTE O BLOCO FICA VISÍVEL!
      state.activeBlockMask = L.polygon([outerRing, innerRing], {
        color: '#0f172a',
        fillColor: '#0f172a',
        fillOpacity: 0.94,
        weight: 2,
        interactive: false
      }).addTo(state.map);

      const lats = innerRing.map(p => p[0]);
      const lngs = innerRing.map(p => p[1]);
      const blockBounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      );

      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        // No celular (tela estreita), não force encolher o bloco inteiro em 350px.
        // Centraliza o bloco com um nível de zoom confortável e legível:
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        state.map.setView([centerLat - 15, centerLng], -0.2, {
          animate: true,
          duration: 0.8
        });
      } else {
        state.map.fitBounds(blockBounds, {
          padding: [35, 35],
          animate: true,
          duration: 0.8
        });
      }
    } else if (meta) {
      const p1 = pixelToLatLng(meta.x1, meta.y1);
      const p2 = pixelToLatLng(meta.x2, meta.y2);
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const centerLat = (p1[0] + p2[0]) / 2;
        const centerLng = (p1[1] + p2[1]) / 2;
        state.map.setView([centerLat - 15, centerLng], -0.2, { animate: true, duration: 0.8 });
      } else {
        state.map.fitBounds(L.latLngBounds(p1, p2), { padding: [35, 35], animate: true, duration: 0.8 });
      }
    }

      // Atualiza banner superior de foco
      const lotsOfBlock = LOTS_DATA.filter(l => l.block === blockName).sort((a, b) => a.lot - b.lot);
      const occCount = lotsOfBlock.filter(l => !!state.neighbors[l.id]).length;
      if (banner) {
        document.getElementById('focusBlockTitle').innerText = `Bloco ${blockName}`;
        document.getElementById('focusBlockSubtitle').innerText = `${lotsOfBlock.length} lotes • ${occCount} ${occCount === 1 ? 'vizinho cadastrado' : 'vizinhos cadastrados'}`;
        banner.style.display = 'flex';
      }

      // Atualiza bandeja inferior de lotes do bloco
      if (tray) {
        document.getElementById('trayTitle').innerText = `Lotes do Bloco ${blockName}:`;
        const trayContainer = document.getElementById('lotsChipsContainer');
        trayContainer.innerHTML = lotsOfBlock.map(l => {
          const isOcc = !!state.neighbors[l.id];
          const n = state.neighbors[l.id];
          const isPre = isOcc && isPreCadastro(n);
          const shortName = isOcc && n.name ? n.name.split(' ')[0] : '';
          const chipClass = isOcc ? (isPre ? 'lot-tray-chip pre' : 'lot-tray-chip occ') : 'lot-tray-chip avail';
          const statusText = isOcc ? (isPre ? ' (Pré-cadastro)' : ' (Confirmado)') : '';
          return `
            <button type="button" class="${chipClass}" onclick="window.app.handleTrayLotClick('${l.id}')" title="Lote ${l.lot} ${isOcc ? '• ' + n.name + statusText : ''}">
              <span class="dot"></span> Lote ${String(l.lot).padStart(2, '0')} ${isOcc ? `(${shortName})` : ''}
            </button>
          `;
        }).join('');
        tray.style.display = 'block';
      }

    if (genControl) genControl.style.display = 'none';
    const fab = document.querySelector('.fab-container');
    if (fab) fab.style.display = 'none';

    updateMarkersVisibility();
  }

  function clearBlockFocus() {
    focusBlock(null);
  }

  function handleTrayLotClick(lotId) {
    const lot = LOTS_BY_ID[lotId];
    if (!lot) return;
    focusLotOnMap(lotId);
    const neighbor = state.neighbors[lotId];
    if (neighbor) {
      showNeighborProfileModal(neighbor, lot);
    } else {
      openRegisterModal(lot.block, lot.lot);
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
    const isMobile = window.innerWidth <= 768;
    const currentZoom = state.map.getZoom();
    const targetZoom = isMobile ? (currentZoom >= 0 ? currentZoom : 0) : 1;
    state.map.setView(latlng, targetZoom, { animate: true, duration: 0.6 });

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
    state.isEditing = false;
    state.editingLotId = null;

    const modal = document.getElementById('registerModal');
    const titleEl = document.getElementById('regModalTitle');
    const submitBtn = document.getElementById('btnSubmitRegister');
    const blockSelect = document.getElementById('regBlock');
    const lotSelect = document.getElementById('regLot');
    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const messageInput = document.getElementById('regMessage');

    if (titleEl) titleEl.innerHTML = `<span>📝</span> Cadastrar Meu Terreno`;
    if (submitBtn) submitBtn.innerHTML = `💾 Salvar e Compartilhar`;

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
    messageInput.value = '';

    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 150);
  }

  // Modal de Edição de Dados do Lote
  function openEditModal(neighbor, lot) {
    state.isEditing = true;
    state.editingLotId = neighbor.id || lot.id;

    const modal = document.getElementById('registerModal');
    const titleEl = document.getElementById('regModalTitle');
    const submitBtn = document.getElementById('btnSubmitRegister');
    const blockSelect = document.getElementById('regBlock');
    const lotSelect = document.getElementById('regLot');
    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const messageInput = document.getElementById('regMessage');

    if (titleEl) titleEl.innerHTML = `<span>✏️</span> Editar Dados do Lote`;
    if (submitBtn) submitBtn.innerHTML = `💾 Atualizar Dados`;

    // Popula blocos e fixa no bloco atual
    blockSelect.innerHTML = AVAILABLE_BLOCKS.map(b => `<option value="${b}">Bloco ${b}</option>`).join('');
    blockSelect.value = neighbor.block;

    // Popula lotes e seleciona lote atual
    updateLotSelectOptions(neighbor.block, neighbor.lot);
    lotSelect.value = neighbor.lot;

    blockSelect.onchange = () => {
      updateLotSelectOptions(blockSelect.value, 1);
    };

    nameInput.value = neighbor.name || '';
    phoneInput.value = neighbor.phone || '';
    messageInput.value = neighbor.message || '';

    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 150);
  }

  function updateLotSelectOptions(blockName, selectedLot = 1) {
    const lotSelect = document.getElementById('regLot');
    const lotsOfBlock = LOTS_DATA.filter(l => l.block === blockName);
    lotSelect.innerHTML = lotsOfBlock.map(l => {
      const isOcc = !!state.neighbors[l.id];
      const isCurrentEditing = state.isEditing && state.editingLotId === l.id;
      return `<option value="${l.lot}">${l.lot} ${isOcc && !isCurrentEditing ? '(Ocupado)' : ''}</option>`;
    }).join('');
    lotSelect.value = selectedLot;
  }

  function closeRegisterModal() {
    document.getElementById('registerModal').classList.remove('active');
    state.isEditing = false;
    state.editingLotId = null;
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const block = document.getElementById('regBlock').value;
    const lot = parseInt(document.getElementById('regLot').value, 10);
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
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
        message
      });

      showToast(state.isEditing ? `Dados do Lote ${lotId} atualizados! 🎉` : `Lote ${lotId} cadastrado com sucesso! 🎉`);
      closeRegisterModal();
      focusLotOnMap(lotId);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar lote. Verifique sua conexão.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = state.isEditing ? '💾 Atualizar Dados' : '💾 Salvar e Compartilhar';
    }
  }

  // Modal de Perfil do Vizinho
  function showNeighborProfileModal(neighbor, lot) {
    const modal = document.getElementById('neighborModal');
    const avatar = document.getElementById('neighborAvatar');
    const nameEl = document.getElementById('neighborName');
    const locationEl = document.getElementById('neighborLocation');
    const messageBox = document.getElementById('neighborMessageBox');
    const whatsappBtn = document.getElementById('neighborWhatsappBtn');
    const editBtn = document.getElementById('btnEditLot');
    const deleteBtn = document.getElementById('btnDeleteLot');

    const isPre = isPreCadastro(neighbor);
    const initial = (neighbor.name || 'V')[0].toUpperCase();
    avatar.innerText = initial;
    if (isPre) {
      avatar.style.background = 'linear-gradient(135deg, #f97316, #ea580c)';
    } else {
      avatar.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    }
    nameEl.innerText = neighbor.name;
    locationEl.innerText = `Bloco ${neighbor.block} • Lote ${neighbor.lot}`;

    if (neighbor.message) {
      messageBox.style.display = 'block';
      messageBox.innerText = `"${neighbor.message}"`;
    } else {
      messageBox.style.display = 'none';
    }

    // Configura link do WhatsApp com mensagem amigável (oculta se não houver telefone)
    const cleanPhone = (neighbor.phone || '').replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length >= 8) {
      const prefilledText = encodeURIComponent(
        `Olá ${neighbor.name}! Sou seu vizinho do Residencial Pacaembu (Bloco/Lote). Vi seu contato no Mapa Interativo!`
      );
      whatsappBtn.href = `https://wa.me/55${cleanPhone}?text=${prefilledText}`;
      whatsappBtn.style.display = 'flex';
    } else {
      whatsappBtn.removeAttribute('href');
      whatsappBtn.style.display = 'none';
    }

    // Ação de editar
    if (editBtn) {
      editBtn.onclick = () => {
        closeNeighborModal();
        openEditModal(neighbor, lot);
      };
    }

    // Ação de excluir / desocupar
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
      const isPre = isPreCadastro(n);
      const cleanPhone = n.phone ? n.phone.replace(/\D/g, '') : '';
      const hasPhone = cleanPhone && cleanPhone.length >= 8;
      const statusBadge = isPre
        ? `<span class="neighbor-status-badge" style="font-size: 10px; background: #ffedd5; color: #c2410c;">Pré-cadastro</span>`
        : `<span class="neighbor-status-badge" style="font-size: 10px; background: #dcfce7; color: #15803d;">Confirmado</span>`;
      const whatsappBtnHtml = hasPhone ? `
        <a class="btn-whatsapp" style="height: 34px; width: 34px; padding: 0; border-radius: var(--radius-sm);" href="https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${n.name}! Sou seu vizinho no Residencial Pacaembu!`)}" target="_blank" title="Chamar no WhatsApp">
          💬
        </a>
      ` : '';

      return `
        <div class="directory-card">
          <div class="directory-card-info">
            <h5>
              ${n.name}
              ${statusBadge}
            </h5>
            <p>📍 Bloco ${n.block} • Lote ${n.lot} ${n.message ? '• "' + n.message + '"' : ''}</p>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn-secondary" style="height: 34px; padding: 0 10px; font-size: 12px;" onclick="window.app.locateAndShow('${n.id}')">
              Ver no Mapa
            </button>
            ${whatsappBtnHtml}
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
                <div class="search-item-title">Bloco ${l.block} • Lote ${l.lot}</div>
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
    const allNeighbors = Object.values(state.neighbors);
    const occupiedCount = allNeighbors.length;
    const confirmedCount = allNeighbors.filter(n => !isPreCadastro(n)).length;
    const preCount = allNeighbors.filter(n => isPreCadastro(n)).length;
    const percent = ((occupiedCount / totalLots) * 100).toFixed(1);

    const countEls = document.querySelectorAll('.stat-occupied-count');
    countEls.forEach(el => el.innerText = occupiedCount);

    const confirmedEls = document.querySelectorAll('.stat-confirmed-count');
    confirmedEls.forEach(el => el.innerText = confirmedCount);

    const preEls = document.querySelectorAll('.stat-pre-count');
    preEls.forEach(el => el.innerText = preCount);

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

  function toggleMapMode() {
    if (!state.imgOverlay) return;
    if (state.mapMode === 'clean') {
      state.mapMode = 'original';
      state.imgOverlay.setUrl('assets/mapa.webp');
      const btn = document.getElementById('btnToggleMapMode');
      if (btn) btn.title = 'Planta Original ativa. Clique para voltar ao Minimalista';
      showToast('Visualizando: Planta Original do Livro');
    } else {
      state.mapMode = 'clean';
      state.imgOverlay.setUrl('assets/mapa_clean.webp');
      const btn = document.getElementById('btnToggleMapMode');
      if (btn) btn.title = 'Mapa Minimalista ativo. Clique para ver Planta Original';
      showToast('Visualizando: Mapa Minimalista (Sem árvores/linhas)');
    }
  }

  // Exposição de métodos para botões inline
  window.app = {
    scrollBlocks,
    focusBlock,
    clearBlockFocus,
    handleTrayLotClick,
    openRegisterModal,
    openEditModal,
    closeRegisterModal,
    closeNeighborModal,
    openDirectoryModal,
    closeDirectoryModal,
    openStatsModal,
    closeStatsModal,
    openConfigModal,
    closeConfigModal,
    saveConfigFromModal,
    toggleMapMode,
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

  // Ajuste dinâmico de redimensionamento para navegadores mobile (barra de endereço inferior/superior)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (state.map) state.map.invalidateSize();
    });
  }
});
