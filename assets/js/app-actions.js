function toggleGastoCartaoField() {
  const payment = document.getElementById("g-forma").value;
  const cardSelect = document.getElementById("g-cartao");
  if (!cardSelect) return;

  const isCredit = payment === "Crédito";
  cardSelect.disabled = !isCredit;
  if (!isCredit) cardSelect.value = "";
}

function addGasto() {
  const descField = document.getElementById("g-desc");
  const valueField = document.getElementById("g-val");
  const cardField = document.getElementById("g-cartao");

  const desc = descField.value.trim();
  const val = parseMoney(valueField.value);
  const membroId = Number(document.getElementById("g-membro").value);
  const cat = document.getElementById("g-cat").value;
  const mes = document.getElementById("g-mes").value || state.viewMonth;
  const forma = document.getElementById("g-forma").value;
  const cardSelected = cardField.value;
  const cartaoId = cardSelected ? Number(cardSelected) : null;

  if (!desc || !Number.isFinite(val) || val <= 0) {
    showToast("Preencha a descrição e um valor válido.", "error");
    if (!desc) {
      descField.focus();
    } else {
      valueField.focus();
    }
    return;
  }

  if (forma === "Crédito" && !cartaoId) {
    showToast("Selecione um cartão para gastos no crédito.", "error");
    cardField.focus();
    return;
  }

  state.gastos.push({
    id: uid(),
    desc,
    valor: val,
    membroId,
    cat,
    mes,
    forma,
    cartaoId: forma === "Crédito" ? cartaoId : null,
  });

  descField.value = "";
  valueField.value = "";
  descField.focus();

  save();
  renderAll();
  showToast("Gasto adicionado com sucesso.", "success");
}

function addParcela() {
  const descField = document.getElementById("p-desc");
  const totalField = document.getElementById("p-total");
  const numField = document.getElementById("p-num");
  const atualField = document.getElementById("p-atual");
  const cardField = document.getElementById("p-cartao");

  const desc = descField.value.trim();
  const totalVal = parseMoney(totalField.value);
  const total = parseInt(numField.value, 10);
  const atual = parseInt(atualField.value, 10) || 1;
  const membroId = Number(document.getElementById("p-membro").value);
  const cardSelected = cardField.value;
  const cartaoId = cardSelected ? Number(cardSelected) : null;
  const inicio = document.getElementById("p-inicio").value || state.viewMonth;

  if (!desc || !Number.isFinite(totalVal) || !Number.isFinite(total) || total <= 0) {
    showToast("Preencha todos os campos obrigatórios da parcela.", "error");
    if (!desc) {
      descField.focus();
    } else if (!Number.isFinite(totalVal)) {
      totalField.focus();
    } else {
      numField.focus();
    }
    return;
  }

  if (!cartaoId) {
    showToast("Selecione um cartão cadastrado para a parcela.", "error");
    cardField.focus();
    return;
  }

  if (atual < 1 || atual > total) {
    showToast("A parcela atual deve estar entre 1 e o total de parcelas.", "error");
    atualField.focus();
    return;
  }

  state.parcelas.push({
    id: uid(),
    desc,
    totalVal,
    total,
    atual,
    membroId,
    cartaoId,
    cartao: "",
    inicio,
    pago: false,
  });

  descField.value = "";
  totalField.value = "";
  numField.value = "";
  descField.focus();

  save();
  renderAll();
  showToast("Parcela adicionada com sucesso.", "success");
}

function addCartao() {
  const bancoId = document.getElementById("c-banco").value;
  const aliasField = document.getElementById("c-apelido");
  const limitField = document.getElementById("c-limite");
  const fechamentoField = document.getElementById("c-fechamento");
  const vencimentoField = document.getElementById("c-vencimento");

  const apelido = aliasField.value.trim();
  const fechamentoDia = safeDay(fechamentoField.value, 7);
  const vencimentoDia = safeDay(vencimentoField.value, 15);
  const limiteAtual = parseMoney(limitField.value);

  if (!bancoId) {
    showToast("Selecione um banco.", "error");
    return;
  }

  if (!Number.isFinite(limiteAtual) || limiteAtual < 0) {
    showToast("Informe um limite válido para o cartão.", "error");
    limitField.focus();
    return;
  }

  if (fechamentoDia === vencimentoDia) {
    showToast("Dia de fechamento e dia de vencimento devem ser diferentes.", "error");
    fechamentoField.focus();
    return;
  }

  const duplicate = state.cartoes.some((card) => {
    const sameBank = card.bancoId === bancoId;
    const sameName = normText(cardName(card)) === normText(apelido || findBank(bancoId).nome);
    return sameBank && sameName;
  });

  if (duplicate) {
    showToast("Já existe um cartão com esse banco/nome.", "error");
    return;
  }

  state.cartoes.push({
    id: uid(),
    bancoId,
    apelido,
    fechamentoDia,
    vencimentoDia,
    limiteAtual,
    limiteHistorico: [{ data: todayISO(), valor: limiteAtual }],
  });

  aliasField.value = "";
  limitField.value = "";
  fechamentoField.value = "7";
  vencimentoField.value = "15";

  save();
  renderAll();
  showPage("cartoes");
  showToast("Cartão cadastrado com sucesso.", "success");
}

function updateCartaoLimite(cardId) {
  const parsedId = Number(cardId);
  if (!Number.isFinite(parsedId)) return;

  const card = state.cartoes.find((item) => item.id === parsedId);
  if (!card) return;

  const suggested = String(card.limiteAtual.toFixed(2)).replace(".", ",");
  const input = prompt(`Novo limite para ${cardName(card)}:`, suggested);
  if (input === null) return;

  const newLimit = parseMoney(input);
  if (!Number.isFinite(newLimit) || newLimit < 0) {
    showToast("Informe um limite válido.", "error");
    return;
  }

  card.limiteAtual = Number(newLimit.toFixed(2));
  card.limiteHistorico = Array.isArray(card.limiteHistorico) ? card.limiteHistorico : [];
  card.limiteHistorico.push({ data: todayISO(), valor: card.limiteAtual });

  save();
  renderAll();
  showToast("Limite atualizado.", "success");
}

function editCartaoDatas(cardId) {
  const parsedId = Number(cardId);
  if (!Number.isFinite(parsedId)) return;

  const card = state.cartoes.find((item) => item.id === parsedId);
  if (!card) return;

  const fechamentoRaw = prompt(`Novo dia de fechamento para ${cardName(card)} (1-31):`, String(card.fechamentoDia));
  if (fechamentoRaw === null) return;

  const vencimentoRaw = prompt(`Novo dia de vencimento para ${cardName(card)} (1-31):`, String(card.vencimentoDia));
  if (vencimentoRaw === null) return;

  const fechamentoDia = safeDay(fechamentoRaw, card.fechamentoDia);
  const vencimentoDia = safeDay(vencimentoRaw, card.vencimentoDia);

  if (fechamentoDia === vencimentoDia) {
    showToast("Dia de fechamento e dia de vencimento devem ser diferentes.", "error");
    return;
  }

  card.fechamentoDia = fechamentoDia;
  card.vencimentoDia = vencimentoDia;

  save();
  renderAll();
  showToast("Datas do cartão atualizadas.", "success");
}

function delCartao(cardId) {
  const parsedId = Number(cardId);
  if (!Number.isFinite(parsedId)) return;

  const card = state.cartoes.find((item) => item.id === parsedId);
  if (!card) return;

  const name = cardName(card);
  openConfirmDialog(`Remover o cartão ${name}? Os lançamentos continuarão salvos, mas sem vínculo com este cartão.`, () => {
    const currentIndex = state.cartoes.findIndex((item) => item.id === parsedId);
    if (currentIndex < 0) return;

    state.gastos = state.gastos.map((gasto) => {
      if (gasto.cartaoId === card.id) {
        return { ...gasto, cartaoId: null };
      }
      return gasto;
    });

    state.parcelas = state.parcelas.map((parcela) => {
      if (parcela.cartaoId === card.id) {
        return { ...parcela, cartaoId: null, cartao: name };
      }
      return parcela;
    });

    state.cartoes.splice(currentIndex, 1);

    save();
    renderAll();
    showToast("Cartão removido.", "info");
  });
}

function addMembro() {
  const nomeField = document.getElementById("m-nome");
  const nome = nomeField.value.trim();
  const cor = document.getElementById("m-cor").value || "#c9a96e";

  if (!nome) {
    showToast("Informe o nome do membro.", "error");
    nomeField.focus();
    return;
  }

  state.membros.push({ id: uid(), nome, cor });
  nomeField.value = "";
  nomeField.focus();

  save();
  renderAll();
  showToast("Membro adicionado.", "success");
}

function delGasto(gastoId) {
  const parsedId = Number(gastoId);
  if (!Number.isFinite(parsedId)) return;

  openConfirmDialog("Remover este gasto?", () => {
    const index = state.gastos.findIndex((gasto) => gasto.id === parsedId);
    if (index < 0) return;

    state.gastos.splice(index, 1);
    save();
    renderAll();
    showToast("Gasto removido.", "info");
  });
}

function delParcela(parcelaId) {
  const parsedId = Number(parcelaId);
  if (!Number.isFinite(parsedId)) return;

  openConfirmDialog("Remover esta parcela?", () => {
    const index = state.parcelas.findIndex((parcela) => parcela.id === parsedId);
    if (index < 0) return;

    state.parcelas.splice(index, 1);
    save();
    renderAll();
    showToast("Parcela removida.", "info");
  });
}

function togglePago(parcelaId) {
  const parsedId = Number(parcelaId);
  if (!Number.isFinite(parsedId)) return;

  const parcela = state.parcelas.find((item) => item.id === parsedId);
  if (!parcela) return;

  parcela.pago = !parcela.pago;
  save();
  renderAll();
  showToast(parcela.pago ? "Parcela marcada como quitada." : "Parcela reativada.", "info");
}

function delMembro(memberId) {
  const parsedId = Number(memberId);
  if (!Number.isFinite(parsedId)) return;

  const principalId = state.membros[0]?.id;
  if (parsedId === principalId) return;

  openConfirmDialog("Remover membro e todos os seus registros?", () => {
    const index = state.membros.findIndex((member) => member.id === parsedId);
    if (index < 0) return;

    const member = state.membros[index];

    state.membros.splice(index, 1);
    state.gastos = state.gastos.filter((gasto) => gasto.membroId !== member.id);
    state.parcelas = state.parcelas.filter((parcela) => parcela.membroId !== member.id);

    save();
    renderAll();
    showToast("Membro e registros removidos.", "info");
  });
}

function init() {
  try {
    load();
    populateBankSelect();

    state.viewMonth = curYM();
    syncMonthUI();

    document.getElementById("g-mes").value = curYM();
    document.getElementById("p-inicio").value = curYM();
    document.getElementById("c-fechamento").value = "7";
    document.getElementById("c-vencimento").value = "15";

    document.getElementById("g-forma").addEventListener("change", toggleGastoCartaoField);

    const gastosSearch = document.getElementById("gastos-search");
    if (gastosSearch) {
      gastosSearch.addEventListener("input", (event) => {
        state.filters.gastosQuery = event.target.value;
        renderGastos();
      });
    }

    const parcelasSearch = document.getElementById("parcelas-search");
    if (parcelasSearch) {
      parcelasSearch.addEventListener("input", (event) => {
        state.filters.parcelasQuery = event.target.value;
        renderParcelas();
      });
    }

    const metaTotalInput = document.getElementById("meta-total");
    if (metaTotalInput) {
      metaTotalInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveMetaMensal();
        }
      });
    }

    window.addEventListener("resize", () => {
      clearTimeout(chartResizeTimer);
      chartResizeTimer = setTimeout(() => {
        renderCharts();
      }, 120);
    });

    state.selectedColor = COLORS[0];
    try {
      renderAll();
    } catch (renderErr) {
      console.error("Erro ao renderizar:", renderErr);
    }

    initAssistant();
  } catch (initErr) {
    console.error("Erro ao inicializar:", initErr);
  }

  // Esconder loading screen após 1.2s (com fallback)
  setTimeout(() => {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
    }
  }, 1200);

  // Fallback: garantir que a tela de carregamento seja removida em 3s mesmo com erros
  setTimeout(() => {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.style.display = "none";
    }
  }, 3000);
}

/* ===== Menu Hambúrguer ===== */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  
  if (!sidebar) return;
  
  const isOpen = sidebar.classList.contains("open");
  
  if (isOpen) {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  } else {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  }
}

/* ===== Fecha menu ao mudar de página ===== */
function showPageWithMenuClose(pageName, btn) {
  showPage(pageName, btn);
  
  // Fechar sidebar em mobile após selecionar página
  if (window.innerWidth <= 600) {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }
}

/* ===== Bottom Navigation (Mobile) ===== */
function navigatePage(pageName, btn) {
  showPage(pageName, null);
}

registerServiceWorker();
init();
