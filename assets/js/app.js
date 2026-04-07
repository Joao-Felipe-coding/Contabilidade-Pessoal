const STORAGE_KEY = "financas-familiar";
const COLORS = ["#c9a96e", "#6aaa84", "#6b9fd4", "#d4665a", "#a78bda", "#e07b9a", "#5bbcb0", "#e8985e"];
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const CHART_COLORS = ["#c9a96e", "#6aaa84", "#6b9fd4", "#d4665a", "#a78bda", "#5bbcb0", "#e8985e"];
const BANKS = [
  { id: "nubank", nome: "Nubank", color: "#820ad1" },
  { id: "mercado-pago", nome: "Mercado Pago", color: "#4299c3" },
  { id: "bradesco", nome: "Bradesco", color: "#c41e3a" },
  { id: "itau", nome: "Itaú", color: "#ec7000" },
  { id: "santander", nome: "Santander", color: "#e41e23" },
  { id: "banco-do-brasil", nome: "Banco do Brasil", color: "#ffd700" },
  { id: "caixa", nome: "Caixa", color: "#003da5" },
  { id: "inter", nome: "Inter", color: "#ff6b00" },
  { id: "c6", nome: "C6 Bank", color: "#1a1a1a" },
  { id: "picpay", nome: "PicPay", color: "#2eb3e6" },
  { id: "outro", nome: "Outro", color: "#888" },
];

let chartResizeTimer = null;

let state = {
  membros: [{ id: 1, nome: "Eu", cor: "#c9a96e" }],
  gastos: [],
  parcelas: [],
  cartoes: [],
  viewMonth: null,
  selectedColor: "#c9a96e",
};

function uid() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseMoney(value) {
  if (value === null || value === undefined) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;

  if (raw.includes(",") && raw.includes(".")) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }

  if (raw.includes(",")) {
    return Number(raw.replace(",", "."));
  }

  return Number(raw);
}

function normText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeDay(value, fallback) {
  const v = parseInt(value, 10);
  if (Number.isNaN(v)) return fallback;
  return Math.max(1, Math.min(31, v));
}

function validYM(value) {
  return /^\d{4}-\d{2}$/.test(value || "") ? value : null;
}

function curYM() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return MONTHS_PT[+m - 1] + " " + y;
}

function monthShortLabel(ym) {
  const [y, m] = ym.split("-");
  return MONTHS_PT[+m - 1].slice(0, 3) + "/" + String(y).slice(2);
}

function monthDiff(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function fmt(v) {
  return (
    "R$ " +
    Number(v || 0)
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

function fmtCompact(v) {
  const value = Number(v || 0);
  if (value >= 1000) {
    return "R$ " + (value / 1000).toFixed(1).replace(".", ",") + "k";
  }
  return "R$ " + value.toFixed(0).replace(".", ",");
}

function formatDateBR(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function findBank(bankId) {
  return BANKS.find((bank) => bank.id === bankId) || BANKS[BANKS.length - 1];
}

function bankFromName(name) {
  const wanted = normText(name);
  return (
    BANKS.find((bank) => {
      const bankName = normText(bank.nome);
      return bankName.includes(wanted) || wanted.includes(bankName);
    }) || BANKS[BANKS.length - 1]
  );
}

function cardName(card) {
  if (!card) return "Cartão";
  const alias = String(card.apelido || "").trim();
  if (alias) return alias;
  return findBank(card.bancoId).nome;
}

function cardLabelById(cardId, fallbackText) {
  if (cardId) {
    const card = getCartao(Number(cardId));
    if (card) {
      const bank = findBank(card.bancoId);
      return `<span class="bank-dot" style="background-color: ${bank.color};"></span> ${cardName(card)}`;
    }
  }
  if (fallbackText) return `<span class="bank-dot" style="background-color: #888;"></span> ${fallbackText}`;
  return `<span class="bank-dot" style="background-color: #888;"></span> Cartão`;
}

function getMembro(id) {
  return state.membros.find((m) => m.id === id) || { nome: "?", cor: "#888" };
}

function getCartao(id) {
  return state.cartoes.find((c) => c.id === id) || null;
}

function avatar(m, size) {
  const s = size || 32;
  const fs = Math.round(s * 0.38);
  return `<div class="avatar" style="width:${s}px;height:${s}px;font-size:${fs}px;background:${m.cor}22;color:${m.cor};border:1.5px solid ${m.cor}55">${m.nome[0].toUpperCase()}</div>`;
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      membros: state.membros,
      gastos: state.gastos,
      parcelas: state.parcelas,
      cartoes: state.cartoes,
    })
  );
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed.membros) state.membros = parsed.membros;
    if (parsed.gastos) state.gastos = parsed.gastos;
    if (parsed.parcelas) state.parcelas = parsed.parcelas;
    if (parsed.cartoes) state.cartoes = parsed.cartoes;
  } catch (_e) {
    state = {
      membros: [{ id: 1, nome: "Eu", cor: "#c9a96e" }],
      gastos: [],
      parcelas: [],
      cartoes: [],
      viewMonth: null,
      selectedColor: "#c9a96e",
    };
  }
  migrateState();
}

function normalizeCard(raw) {
  const fallbackBank = bankFromName(raw?.bancoNome || raw?.apelido || "");
  const bankId = BANKS.some((b) => b.id === raw?.bancoId) ? raw.bancoId : fallbackBank.id;
  const limit = Number(raw?.limiteAtual);
  const safeLimit = Number.isFinite(limit) && limit >= 0 ? limit : 0;

  const history = Array.isArray(raw?.limiteHistorico)
    ? raw.limiteHistorico
        .map((entry) => ({
          data: /^\d{4}-\d{2}-\d{2}$/.test(entry?.data) ? entry.data : todayISO(),
          valor: Number.isFinite(Number(entry?.valor)) ? Number(entry.valor) : 0,
        }))
        .filter((entry) => entry.valor >= 0)
    : [];

  return {
    id: Number(raw?.id) || uid(),
    bancoId: bankId,
    apelido: String(raw?.apelido || "").trim(),
    fechamentoDia: safeDay(raw?.fechamentoDia ?? raw?.fechamento, 7),
    vencimentoDia: safeDay(raw?.vencimentoDia ?? raw?.vencimento, 15),
    limiteAtual: safeLimit,
    limiteHistorico: history.length ? history : [{ data: todayISO(), valor: safeLimit }],
  };
}

function ensureCardByLegacyName(name) {
  const clean = String(name || "").trim();
  if (!clean) return null;

  const existing = state.cartoes.find((card) => {
    const primary = normText(cardName(card));
    const bankName = normText(findBank(card.bancoId).nome);
    const wanted = normText(clean);
    return primary === wanted || bankName === wanted;
  });

  if (existing) return existing.id;

  const bank = bankFromName(clean);
  const created = {
    id: uid(),
    bancoId: bank.id,
    apelido: clean,
    fechamentoDia: 7,
    vencimentoDia: 15,
    limiteAtual: 0,
    limiteHistorico: [{ data: todayISO(), valor: 0 }],
  };

  state.cartoes.push(created);
  return created.id;
}

function migrateState() {
  if (!Array.isArray(state.membros) || !state.membros.length) {
    state.membros = [{ id: 1, nome: "Eu", cor: "#c9a96e" }];
  }

  state.membros = state.membros.map((member) => ({
    id: Number(member?.id) || uid(),
    nome: String(member?.nome || "Membro").trim() || "Membro",
    cor: String(member?.cor || "#888888"),
  }));

  state.cartoes = Array.isArray(state.cartoes) ? state.cartoes.map(normalizeCard) : [];

  state.gastos = Array.isArray(state.gastos)
    ? state.gastos.map((raw) => {
        const forma = ["Dinheiro", "Débito", "PIX", "Crédito"].includes(raw?.forma) ? raw.forma : "Dinheiro";
        let cartaoId = raw?.cartaoId ? Number(raw.cartaoId) : null;

        if (forma === "Crédito" && (!cartaoId || !getCartao(cartaoId))) {
          cartaoId = ensureCardByLegacyName(raw?.cartao);
        }

        if (forma !== "Crédito") cartaoId = null;

        return {
          desc: String(raw?.desc || "").trim(),
          valor: Number.isFinite(Number(raw?.valor)) ? Number(raw.valor) : 0,
          membroId: Number(raw?.membroId) || state.membros[0].id,
          cat: String(raw?.cat || "Outro"),
          mes: validYM(raw?.mes) || curYM(),
          forma,
          cartaoId: cartaoId || null,
        };
      })
    : [];

  state.parcelas = Array.isArray(state.parcelas)
    ? state.parcelas.map((raw) => {
        const total = Math.max(1, parseInt(raw?.total, 10) || 1);
        const atualRaw = parseInt(raw?.atual, 10) || 1;
        const atual = Math.min(total, Math.max(1, atualRaw));

        let cartaoId = raw?.cartaoId ? Number(raw.cartaoId) : null;
        if (!cartaoId || !getCartao(cartaoId)) {
          cartaoId = ensureCardByLegacyName(raw?.cartao);
        }

        return {
          desc: String(raw?.desc || "").trim(),
          totalVal: Number.isFinite(Number(raw?.totalVal)) ? Number(raw.totalVal) : 0,
          total,
          atual,
          membroId: Number(raw?.membroId) || state.membros[0].id,
          cartaoId: cartaoId || null,
          cartao: String(raw?.cartao || "").trim(),
          inicio: validYM(raw?.inicio) || curYM(),
          pago: Boolean(raw?.pago),
        };
      })
    : [];

  state.gastos = state.gastos.filter((g) => g.desc && g.valor > 0);
  state.parcelas = state.parcelas.filter((p) => p.desc && p.totalVal > 0 && p.total > 0);
}

function gastosDoMes(ym) {
  return state.gastos.filter((g) => g.mes === ym);
}

function parcelasDoMes(ym) {
  return state.parcelas
    .filter((p) => {
      const fim = addMonths(p.inicio, p.total - p.atual);
      return ym >= p.inicio && ym <= fim && !p.pago;
    })
    .map((p) => {
      const parcAtual = Math.min(p.atual + monthDiff(p.inicio, ym), p.total);
      return {
        ...p,
        parcelaAtual: parcAtual,
        valorParcela: +(p.totalVal / p.total).toFixed(2),
      };
    });
}

function chargesByCard(ym) {
  const totals = {};
  state.cartoes.forEach((card) => {
    totals[card.id] = 0;
  });

  gastosDoMes(ym).forEach((gasto) => {
    if (gasto.forma === "Crédito" && gasto.cartaoId && totals[gasto.cartaoId] !== undefined) {
      totals[gasto.cartaoId] += gasto.valor;
    }
  });

  parcelasDoMes(ym).forEach((parcela) => {
    if (parcela.cartaoId && totals[parcela.cartaoId] !== undefined) {
      totals[parcela.cartaoId] += parcela.valorParcela;
    }
  });

  return totals;
}

function populateBankSelect() {
  const select = document.getElementById("c-banco");
  if (!select) return;
  select.innerHTML = BANKS.map((bank) => `<option value="${bank.id}">${bank.nome}</option>`).join("");
}

function renderMemberSelects() {
  ["g-membro", "p-membro"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const prev = select.value;
    select.innerHTML = state.membros.map((member) => `<option value="${member.id}">${member.nome}</option>`).join("");
    if (state.membros.some((member) => String(member.id) === prev)) {
      select.value = prev;
    }
  });
}

function renderCardSelects() {
  const configs = [
    { id: "g-cartao", placeholder: "Selecione o cartão" },
    { id: "p-cartao", placeholder: "Selecione o cartão" },
  ];

  configs.forEach((config) => {
    const select = document.getElementById(config.id);
    if (!select) return;
    const prev = select.value;

    select.innerHTML =
      [`<option value="">${config.placeholder}</option>`]
        .concat(
          state.cartoes.map((card) => {
            return `<option value="${card.id}">${cardName(card)}</option>`;
          })
        )
        .join("");

    if (state.cartoes.some((card) => String(card.id) === prev)) {
      select.value = prev;
    }
  });

  toggleGastoCartaoField();
}

function showPage(name, btn) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((button) => button.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  if (btn) {
    btn.classList.add("active");
  } else {
    const autoBtn = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (autoBtn) autoBtn.classList.add("active");
  }

  renderAll();
}

function changeMonth(delta) {
  state.viewMonth = addMonths(state.viewMonth, delta);
  document.getElementById("month-label").textContent = monthLabel(state.viewMonth);
  document.getElementById("resumo-sub").textContent = "Visão geral de " + monthLabel(state.viewMonth);
  renderAll();
}

function renderMetrics() {
  const ym = state.viewMonth;
  const gs = gastosDoMes(ym);
  const ps = parcelasDoMes(ym);

  const totalG = gs.reduce((sum, g) => sum + g.valor, 0);
  const totalP = ps.reduce((sum, p) => sum + p.valorParcela, 0);
  const total = totalG + totalP;
  const items = gs.length + ps.length;

  const usedCredit = Object.values(chargesByCard(ym)).reduce((sum, value) => sum + value, 0);
  const totalLimit = state.cartoes.reduce((sum, card) => sum + Number(card.limiteAtual || 0), 0);
  const usagePct = totalLimit > 0 ? (usedCredit / totalLimit) * 100 : 0;

  const metrics = [
    { label: "Gastos avulsos", val: fmt(totalG), cls: "" },
    { label: "Em parcelas", val: fmt(totalP), cls: "c-gold" },
    { label: "Total do mês", val: fmt(total), cls: "c-red" },
    {
      label: "Uso do crédito",
      val: totalLimit > 0 ? `${Math.round(usagePct)}%` : "-",
      cls: usagePct >= 85 ? "c-red" : "c-green",
    },
    { label: "Registros", val: items, cls: "" },
  ];

  document.getElementById("metrics").innerHTML = metrics
    .map(
      (metric, index) =>
        `<div class="metric" style="animation-delay:${index * 0.05}s">
          <div class="metric-label">${metric.label}</div>
          <div class="metric-val ${metric.cls}">${metric.val}</div>
        </div>`
    )
    .join("");
}

function renderByMember() {
  const ym = state.viewMonth;
  const gs = gastosDoMes(ym);
  const ps = parcelasDoMes(ym);
  const totals = {};

  state.membros.forEach((member) => {
    totals[member.id] = 0;
  });

  gs.forEach((gasto) => {
    if (totals[gasto.membroId] !== undefined) totals[gasto.membroId] += gasto.valor;
  });

  ps.forEach((parcela) => {
    if (totals[parcela.membroId] !== undefined) totals[parcela.membroId] += parcela.valorParcela;
  });

  const max = Math.max(...Object.values(totals), 1);
  const root = document.getElementById("by-member");

  if (!state.membros.length) {
    root.innerHTML = '<div class="empty">Nenhum membro</div>';
    return;
  }

  root.innerHTML = state.membros
    .map(
      (member) =>
        `<div class="member-bar">
          ${avatar(member)}
          <div class="member-bar-info">
            <div class="member-bar-top">
              <span style="font-weight:500">${member.nome}</span>
              <span style="color:var(--text2);font-size:13px">${fmt(totals[member.id] || 0)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${Math.round(((totals[member.id] || 0) / max) * 100)}%;background:${member.cor}"></div>
            </div>
          </div>
        </div>`
    )
    .join("");
}

function renderParcelasResumo() {
  const parcelas = parcelasDoMes(state.viewMonth);
  const root = document.getElementById("parcelas-resumo");

  if (!parcelas.length) {
    root.innerHTML = '<div class="empty">Sem parcelas neste mês</div>';
    return;
  }

  root.innerHTML = parcelas
    .map((parcela) => {
      const member = getMembro(parcela.membroId);
      const cardLabel = cardLabelById(parcela.cartaoId, parcela.cartao || "Cartão");
      return `<div class="list-item">
        ${avatar(member)}
        <div class="item-main">
          <div class="item-name">${parcela.desc} <span class="tag">${cardLabel}</span></div>
          <div class="item-meta">${parcela.parcelaAtual}/${parcela.total} parcela • ${member.nome}</div>
        </div>
        <div class="item-val">${fmt(parcela.valorParcela)}</div>
      </div>`;
    })
    .join("");
}

function renderGastos() {
  const root = document.getElementById("gastos-list");

  if (!state.gastos.length) {
    root.innerHTML = '<div class="empty">Nenhum gasto ainda. Adicione o primeiro!</div>';
    return;
  }

  const sorted = [...state.gastos].reverse();
  root.innerHTML = sorted
    .map((gasto, index) => {
      const member = getMembro(gasto.membroId);
      const realIndex = state.gastos.length - 1 - index;
      const paymentInfo =
        gasto.forma === "Crédito"
          ? `${gasto.forma} • ${cardLabelById(gasto.cartaoId)}`
          : gasto.forma || "Dinheiro";

      return `<div class="list-item">
        ${avatar(member)}
        <div class="item-main">
          <div class="item-name">${gasto.desc} <span class="tag">${gasto.cat}</span></div>
          <div class="item-meta">${monthLabel(gasto.mes)} • ${member.nome} • ${paymentInfo}</div>
        </div>
        <div class="item-val">${fmt(gasto.valor)}</div>
        <button class="btn btn-danger btn-sm" onclick="delGasto(${realIndex})">✕</button>
      </div>`;
    })
    .join("");
}

function renderParcelas() {
  const root = document.getElementById("parcelas-list");

  if (!state.parcelas.length) {
    root.innerHTML = '<div class="empty">Nenhuma parcela cadastrada</div>';
    return;
  }

  root.innerHTML = state.parcelas
    .map((parcela, index) => {
      const member = getMembro(parcela.membroId);
      const endMonth = addMonths(parcela.inicio, parcela.total - parcela.atual);
      const progress = Math.round((parcela.atual / parcela.total) * 100);
      const cardLabel = cardLabelById(parcela.cartaoId, parcela.cartao || "Cartão");

      const badge = parcela.pago
        ? '<span class="badge badge-green">Quitado</span>'
        : '<span class="badge badge-gold">Ativo</span>';

      return `<div class="parcela-card">
        <div class="parcela-top">
          ${avatar(member)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;font-size:13px">${parcela.desc} ${badge}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${cardLabel} • ${member.nome} • termina ${monthLabel(endMonth)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-weight:500;font-size:13px">${fmt(parcela.totalVal / parcela.total)}<span style="color:var(--text3);font-size:10px">/mês</span></div>
            <div style="font-size:10px;color:var(--text3)">${fmt(parcela.totalVal)} total</div>
          </div>
        </div>
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
            <span>${parcela.atual} de ${parcela.total} parcelas pagas</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%;background:var(--green)"></div>
          </div>
        </div>
        <div class="parcela-actions" style="justify-content:flex-end">
          <button class="btn btn-sm" onclick="togglePago(${index})">${parcela.pago ? "Reativar" : "Marcar quitado"}</button>
          <button class="btn btn-danger btn-sm" onclick="delParcela(${index})">Remover</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderCartoes() {
  const root = document.getElementById("cartoes-list");
  if (!root) return;

  if (!state.cartoes.length) {
    root.innerHTML = '<div class="empty">Nenhum cartão cadastrado ainda</div>';
    return;
  }

  const usage = chargesByCard(state.viewMonth);

  root.innerHTML = state.cartoes
    .map((card, index) => {
      const bank = findBank(card.bancoId);
      const used = usage[card.id] || 0;
      const limit = Number(card.limiteAtual || 0);
      const available = limit - used;
      const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
      const pctBar = Math.max(0, Math.min(100, pct));
      const badgeClass = pct >= 100 ? "badge-red" : pct >= 75 ? "badge-gold" : "badge-green";
      const lastUpdate = card.limiteHistorico?.[card.limiteHistorico.length - 1]?.data;

      return `<div class="card-item">
        <div class="card-item-top">
          <div class="bank-chip">
            <span class="bank-icon" style="background-color: ${bank.color};"></span>
            <div class="item-main">
              <div class="item-name">${cardName(card)}</div>
              <div class="item-meta">${bank.nome}</div>
            </div>
          </div>
          <span class="badge ${badgeClass}">${limit > 0 ? `${pct}% usado` : "Sem limite"}</span>
        </div>

        <div class="card-summary-grid">
          <div class="summary-cell">
            <span>Limite</span>
            <strong>${fmt(limit)}</strong>
          </div>
          <div class="summary-cell">
            <span>Uso no mês</span>
            <strong>${fmt(used)}</strong>
          </div>
          <div class="summary-cell">
            <span>Disponível</span>
            <strong>${fmt(available)}</strong>
          </div>
          <div class="summary-cell">
            <span>Última atualização</span>
            <strong>${formatDateBR(lastUpdate)}</strong>
          </div>
        </div>

        <div class="item-meta">Fecha dia ${card.fechamentoDia} • Vence dia ${card.vencimentoDia}</div>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${pctBar}%;background:${pct >= 100 ? "var(--red)" : "var(--accent)"}"></div>
        </div>

        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="updateCartaoLimite(${index})">Atualizar limite</button>
          <button class="btn btn-sm" onclick="editCartaoDatas(${index})">Editar datas</button>
          <button class="btn btn-danger btn-sm" onclick="delCartao(${index})">Remover</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderMembros() {
  const root = document.getElementById("membros-list");
  root.innerHTML = state.membros.length
    ? state.membros
        .map(
          (member, index) =>
            `<div class="list-item">
              ${avatar(member, 40)}
              <div class="item-main"><div class="item-name">${member.nome}</div></div>
              ${
                index > 0
                  ? `<button class="btn btn-danger btn-sm" onclick="delMembro(${index})">Remover</button>`
                  : '<span class="badge badge-gold">Principal</span>'
              }
            </div>`
        )
        .join("")
    : '<div class="empty">Nenhum membro</div>';
}

function renderColorOptions() {
  const root = document.getElementById("color-options");
  if (!root) return;

  root.innerHTML = COLORS.map(
    (color) => `<div class="color-opt ${state.selectedColor === color ? "selected" : ""}" style="background:${color}" onclick="selectColor('${color}')"></div>`
  ).join("");
}

function selectColor(color) {
  state.selectedColor = color;
  document.getElementById("m-cor").value = color;
  renderColorOptions();
}

function getCanvasCtx(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  return { ctx, width: rect.width, height: rect.height };
}

function buildCategoryData(ym) {
  const totals = {};

  gastosDoMes(ym).forEach((gasto) => {
    totals[gasto.cat] = (totals[gasto.cat] || 0) + gasto.valor;
  });

  parcelasDoMes(ym).forEach((parcela) => {
    totals.Parcelas = (totals.Parcelas || 0) + parcela.valorParcela;
  });

  let entries = Object.entries(totals).map(([label, value]) => ({ label, value }));
  entries = entries.filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value);

  if (entries.length > 6) {
    const top = entries.slice(0, 5);
    const others = entries.slice(5).reduce((sum, entry) => sum + entry.value, 0);
    top.push({ label: "Outros", value: others });
    return top;
  }

  return entries;
}

function drawDonutChart(canvas, data) {
  const setup = getCanvasCtx(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;

  if (!data.length) {
    ctx.fillStyle = "#5a5651";
    ctx.font = "13px DM Sans";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados no mês", width / 2, height / 2);
    return;
  }

  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const lineWidth = Math.max(18, radius * 0.38);

  let startAngle = -Math.PI / 2;
  data.forEach((entry, index) => {
    const slice = (entry.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.strokeStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
    startAngle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, radius - lineWidth * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#181818";
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#9a958e";
  ctx.font = "11px DM Sans";
  ctx.fillText("Total", cx, cy - 8);

  ctx.fillStyle = "#f0ede8";
  ctx.font = "600 14px DM Sans";
  ctx.fillText(fmtCompact(total), cx, cy + 12);
}

function drawBarChart(canvas, labels, values) {
  const setup = getCanvasCtx(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const max = Math.max(...values, 1);

  const padTop = 18;
  const padRight = 12;
  const padBottom = 34;
  const padLeft = 36;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  const slot = chartW / values.length;
  const barW = slot * 0.56;

  values.forEach((value, index) => {
    const h = (value / max) * chartH;
    const x = padLeft + index * slot + (slot - barW) / 2;
    const y = padTop + (chartH - h);

    ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#9a958e";
    ctx.font = "10px DM Sans";
    ctx.textAlign = "center";
    ctx.fillText(labels[index], x + barW / 2, height - 12);
  });

  ctx.fillStyle = "#9a958e";
  ctx.font = "10px DM Sans";
  ctx.textAlign = "left";
  ctx.fillText(fmtCompact(max), 4, padTop + 4);
  ctx.fillText("R$ 0", 8, padTop + chartH + 3);
}

function renderCharts() {
  const resumoPage = document.getElementById("page-resumo");
  if (!resumoPage || !resumoPage.classList.contains("active")) return;

  const categoryCanvas = document.getElementById("chart-categories");
  const evolutionCanvas = document.getElementById("chart-evolution");
  const legend = document.getElementById("chart-categories-legend");

  const categoryData = buildCategoryData(state.viewMonth);
  drawDonutChart(categoryCanvas, categoryData);

  legend.innerHTML = categoryData.length
    ? categoryData
        .map(
          (entry, index) =>
            `<div class="legend-item">
              <span class="legend-left">
                <span class="legend-dot" style="background:${CHART_COLORS[index % CHART_COLORS.length]}"></span>
                <span>${entry.label}</span>
              </span>
              <strong>${fmt(entry.value)}</strong>
            </div>`
        )
        .join("")
    : '<div class="empty">Sem dados para o gráfico</div>';

  const labels = [];
  const values = [];
  for (let i = 5; i >= 0; i -= 1) {
    const ym = addMonths(state.viewMonth, -i);
    const total =
      gastosDoMes(ym).reduce((sum, gasto) => sum + gasto.valor, 0) +
      parcelasDoMes(ym).reduce((sum, parcela) => sum + parcela.valorParcela, 0);

    labels.push(monthShortLabel(ym));
    values.push(total);
  }

  drawBarChart(evolutionCanvas, labels, values);
}

function renderAll() {
  renderMemberSelects();
  renderCardSelects();
  renderMetrics();
  renderByMember();
  renderParcelasResumo();
  renderGastos();
  renderParcelas();
  renderCartoes();
  renderMembros();
  renderColorOptions();
  renderCharts();
}

function toggleGastoCartaoField() {
  const payment = document.getElementById("g-forma").value;
  const cardSelect = document.getElementById("g-cartao");
  if (!cardSelect) return;

  const isCredit = payment === "Crédito";
  cardSelect.disabled = !isCredit;
  if (!isCredit) cardSelect.value = "";
}

function addGasto() {
  const desc = document.getElementById("g-desc").value.trim();
  const val = parseMoney(document.getElementById("g-val").value);
  const membroId = Number(document.getElementById("g-membro").value);
  const cat = document.getElementById("g-cat").value;
  const mes = document.getElementById("g-mes").value || state.viewMonth;
  const forma = document.getElementById("g-forma").value;
  const cardSelected = document.getElementById("g-cartao").value;
  const cartaoId = cardSelected ? Number(cardSelected) : null;

  if (!desc || !Number.isFinite(val) || val <= 0) {
    alert("Preencha a descrição e um valor válido.");
    return;
  }

  if (forma === "Crédito" && !cartaoId) {
    alert("Selecione um cartão para gastos no crédito.");
    return;
  }

  state.gastos.push({
    desc,
    valor: val,
    membroId,
    cat,
    mes,
    forma,
    cartaoId: forma === "Crédito" ? cartaoId : null,
  });

  document.getElementById("g-desc").value = "";
  document.getElementById("g-val").value = "";

  save();
  renderAll();
}

function addParcela() {
  const desc = document.getElementById("p-desc").value.trim();
  const totalVal = parseMoney(document.getElementById("p-total").value);
  const total = parseInt(document.getElementById("p-num").value, 10);
  const atual = parseInt(document.getElementById("p-atual").value, 10) || 1;
  const membroId = Number(document.getElementById("p-membro").value);
  const cardSelected = document.getElementById("p-cartao").value;
  const cartaoId = cardSelected ? Number(cardSelected) : null;
  const inicio = document.getElementById("p-inicio").value || state.viewMonth;

  if (!desc || !Number.isFinite(totalVal) || !Number.isFinite(total) || total <= 0) {
    alert("Preencha todos os campos obrigatórios da parcela.");
    return;
  }

  if (!cartaoId) {
    alert("Selecione um cartão cadastrado para a parcela.");
    return;
  }

  if (atual < 1 || atual > total) {
    alert("A parcela atual deve estar entre 1 e o total de parcelas.");
    return;
  }

  state.parcelas.push({
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

  document.getElementById("p-desc").value = "";
  document.getElementById("p-total").value = "";
  document.getElementById("p-num").value = "";

  save();
  renderAll();
}

function addCartao() {
  const bancoId = document.getElementById("c-banco").value;
  const apelido = document.getElementById("c-apelido").value.trim();
  const fechamentoDia = safeDay(document.getElementById("c-fechamento").value, 7);
  const vencimentoDia = safeDay(document.getElementById("c-vencimento").value, 15);
  const limiteAtual = parseMoney(document.getElementById("c-limite").value);

  if (!bancoId) {
    alert("Selecione um banco.");
    return;
  }

  if (!Number.isFinite(limiteAtual) || limiteAtual < 0) {
    alert("Informe um limite válido para o cartão.");
    return;
  }

  if (fechamentoDia === vencimentoDia) {
    alert("Dia de fechamento e dia de vencimento devem ser diferentes.");
    return;
  }

  const duplicate = state.cartoes.some((card) => {
    const sameBank = card.bancoId === bancoId;
    const sameName = normText(cardName(card)) === normText(apelido || findBank(bancoId).nome);
    return sameBank && sameName;
  });

  if (duplicate) {
    alert("Já existe um cartão com esse banco/nome.");
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

  document.getElementById("c-apelido").value = "";
  document.getElementById("c-limite").value = "";
  document.getElementById("c-fechamento").value = "7";
  document.getElementById("c-vencimento").value = "15";

  save();
  renderAll();
  showPage("cartoes");
}

function updateCartaoLimite(index) {
  const card = state.cartoes[index];
  if (!card) return;

  const suggested = String(card.limiteAtual.toFixed(2)).replace(".", ",");
  const input = prompt(`Novo limite para ${cardName(card)}:`, suggested);
  if (input === null) return;

  const newLimit = parseMoney(input);
  if (!Number.isFinite(newLimit) || newLimit < 0) {
    alert("Informe um limite válido.");
    return;
  }

  card.limiteAtual = Number(newLimit.toFixed(2));
  card.limiteHistorico = Array.isArray(card.limiteHistorico) ? card.limiteHistorico : [];
  card.limiteHistorico.push({ data: todayISO(), valor: card.limiteAtual });

  save();
  renderAll();
}

function editCartaoDatas(index) {
  const card = state.cartoes[index];
  if (!card) return;

  const fechamentoRaw = prompt(`Novo dia de fechamento para ${cardName(card)} (1-31):`, String(card.fechamentoDia));
  if (fechamentoRaw === null) return;

  const vencimentoRaw = prompt(`Novo dia de vencimento para ${cardName(card)} (1-31):`, String(card.vencimentoDia));
  if (vencimentoRaw === null) return;

  const fechamentoDia = safeDay(fechamentoRaw, card.fechamentoDia);
  const vencimentoDia = safeDay(vencimentoRaw, card.vencimentoDia);

  if (fechamentoDia === vencimentoDia) {
    alert("Dia de fechamento e dia de vencimento devem ser diferentes.");
    return;
  }

  card.fechamentoDia = fechamentoDia;
  card.vencimentoDia = vencimentoDia;

  save();
  renderAll();
}

function delCartao(index) {
  const card = state.cartoes[index];
  if (!card) return;

  const name = cardName(card);
  if (!confirm(`Remover o cartão ${name}? Os lançamentos continuarão salvos, mas sem vínculo com este cartão.`)) return;

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

  state.cartoes.splice(index, 1);

  save();
  renderAll();
}

function addMembro() {
  const nome = document.getElementById("m-nome").value.trim();
  const cor = document.getElementById("m-cor").value || "#c9a96e";

  if (!nome) {
    alert("Informe o nome do membro.");
    return;
  }

  state.membros.push({ id: uid(), nome, cor });
  document.getElementById("m-nome").value = "";

  save();
  renderAll();
}

function delGasto(index) {
  if (!confirm("Remover este gasto?")) return;
  state.gastos.splice(index, 1);
  save();
  renderAll();
}

function delParcela(index) {
  if (!confirm("Remover esta parcela?")) return;
  state.parcelas.splice(index, 1);
  save();
  renderAll();
}

function togglePago(index) {
  state.parcelas[index].pago = !state.parcelas[index].pago;
  save();
  renderAll();
}

function delMembro(index) {
  if (index === 0) return;
  if (!confirm("Remover membro e todos os seus registros?")) return;

  const member = state.membros[index];
  state.membros.splice(index, 1);
  state.gastos = state.gastos.filter((gasto) => gasto.membroId !== member.id);
  state.parcelas = state.parcelas.filter((parcela) => parcela.membroId !== member.id);

  save();
  renderAll();
}

function init() {
  load();
  populateBankSelect();

  state.viewMonth = curYM();
  document.getElementById("month-label").textContent = monthLabel(state.viewMonth);
  document.getElementById("resumo-sub").textContent = "Visão geral de " + monthLabel(state.viewMonth);

  document.getElementById("g-mes").value = curYM();
  document.getElementById("p-inicio").value = curYM();
  document.getElementById("c-fechamento").value = "7";
  document.getElementById("c-vencimento").value = "15";

  document.getElementById("g-forma").addEventListener("change", toggleGastoCartaoField);

  window.addEventListener("resize", () => {
    clearTimeout(chartResizeTimer);
    chartResizeTimer = setTimeout(() => {
      renderCharts();
    }, 120);
  });

  state.selectedColor = COLORS[0];
  renderAll();

  // Esconder loading screen após 1.2s
  setTimeout(() => {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
    }
  }, 1200);
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
  // Mudar página
  showPage(pageName, null);
  
  // Atualizar ícone ativo na bottom-nav
  const navItems = document.querySelectorAll('.bottom-nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });
  
  // Também atualizar sidebar em desktop
  const sidebarBtns = document.querySelectorAll('.nav-btn');
  sidebarBtns.forEach(b => {
    b.classList.remove('active');
    if (b.dataset.page === pageName) {
      b.classList.add('active');
    }
  });
}

init();
