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
let alertActionMap = {};

let state = {
  membros: [{ id: 1, nome: "Eu", cor: "#c9a96e" }],
  gastos: [],
  parcelas: [],
  cartoes: [],
  metasMensais: {},
  alertasResolvidos: [],
  viewMonth: null,
  selectedColor: "#c9a96e",
  filters: {
    gastosQuery: "",
    parcelasQuery: "",
  },
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  return next !== undefined ? sortedValues[base] + rest * (next - sortedValues[base]) : sortedValues[base];
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

function showToast(message, type) {
  const container = document.getElementById("toast-container");
  const toastType = ["success", "error", "info"].includes(type) ? type : "info";

  if (!container) {
    if (toastType === "error") alert(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${toastType}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, 2500);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!window.isSecureContext && !isLocalHost) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Falha ao registrar service worker:", error);
    });
  });
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
      metasMensais: state.metasMensais,
      alertasResolvidos: state.alertasResolvidos,
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
    if (parsed.metasMensais) state.metasMensais = parsed.metasMensais;
    if (parsed.alertasResolvidos) state.alertasResolvidos = parsed.alertasResolvidos;
  } catch (_e) {
    state = {
      membros: [{ id: 1, nome: "Eu", cor: "#c9a96e" }],
      gastos: [],
      parcelas: [],
      cartoes: [],
      metasMensais: {},
      alertasResolvidos: [],
      viewMonth: null,
      selectedColor: "#c9a96e",
      filters: {
        gastosQuery: "",
        parcelasQuery: "",
      },
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

  if (!state.metasMensais || typeof state.metasMensais !== "object" || Array.isArray(state.metasMensais)) {
    state.metasMensais = {};
  }

  const metas = {};
  Object.entries(state.metasMensais).forEach(([ym, value]) => {
    const validMonth = validYM(ym);
    const parsed = Number(value);
    if (validMonth && Number.isFinite(parsed) && parsed > 0) {
      metas[validMonth] = Number(parsed.toFixed(2));
    }
  });
  state.metasMensais = metas;

  state.alertasResolvidos = Array.isArray(state.alertasResolvidos)
    ? state.alertasResolvidos.filter((key) => typeof key === "string" && key.length <= 120)
    : [];
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

function totalsByMonth(ym) {
  const gastos = gastosDoMes(ym);
  const parcelas = parcelasDoMes(ym);

  const totalG = gastos.reduce((sum, gasto) => sum + gasto.valor, 0);
  const totalP = parcelas.reduce((sum, parcela) => sum + parcela.valorParcela, 0);

  return {
    gastos,
    parcelas,
    totalG,
    totalP,
    total: totalG + totalP,
  };
}

function projectionFactor(ym) {
  if (ym !== curYM()) return 1;

  const now = new Date();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.max(1, now.getDate());
  return Math.max(elapsed / totalDays, 0.08);
}

function projectionByMonth(ym) {
  const totals = totalsByMonth(ym);
  const factor = projectionFactor(ym);
  const projected = factor >= 1 ? totals.total : totals.total / factor;

  return {
    ...totals,
    factor,
    projected,
  };
}

function metaDoMes(ym) {
  return Number(state.metasMensais?.[ym] || 0);
}

function buildAlertProfile(ym) {
  const months = Array.from({ length: 6 }, (_, index) => addMonths(ym, -index));

  const usageSamples = months
    .map((month) => {
      const totalLimit = state.cartoes.reduce((sum, card) => sum + Number(card.limiteAtual || 0), 0);
      if (totalLimit <= 0) return null;

      const used = Object.values(chargesByCard(month)).reduce((sum, value) => sum + value, 0);
      return (used / totalLimit) * 100;
    })
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const cardWarn = usageSamples.length ? clamp(Math.round(quantile(usageSamples, 0.5) + 8), 68, 85) : 75;
  const cardCritical = usageSamples.length
    ? clamp(Math.max(cardWarn + 8, Math.round(quantile(usageSamples, 0.8) + 10)), 82, 95)
    : 90;

  const expenseValues = state.gastos
    .filter((gasto) => {
      const diff = monthDiff(gasto.mes, ym);
      return diff >= 0 && diff <= 5;
    })
    .map((gasto) => Number(gasto.valor))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  let expenseThreshold = 350;
  let expenseHighThreshold = 650;

  if (expenseValues.length >= 8) {
    const q1 = quantile(expenseValues, 0.25);
    const q3 = quantile(expenseValues, 0.75);
    const iqr = Math.max(0, q3 - q1);

    expenseThreshold = Math.max(180, q3 + iqr * 1.2);
    expenseHighThreshold = Math.max(expenseThreshold * 1.45, q3 + iqr * 2);
  } else if (expenseValues.length >= 3) {
    const average = expenseValues.reduce((sum, value) => sum + value, 0) / expenseValues.length;
    const maxValue = expenseValues[expenseValues.length - 1];

    expenseThreshold = Math.max(250, average * 1.8, maxValue * 0.72);
    expenseHighThreshold = Math.max(expenseThreshold * 1.5, maxValue * 0.9);
  }

  const monthTotals = months.map((month) => totalsByMonth(month).total).filter((total) => total > 0);
  let goalBuffer = 0.05;

  if (monthTotals.length >= 3) {
    const avg = monthTotals.reduce((sum, value) => sum + value, 0) / monthTotals.length;
    const variance = monthTotals.reduce((sum, value) => sum + (value - avg) ** 2, 0) / monthTotals.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
    goalBuffer = clamp(0.04 + cv * 0.08, 0.04, 0.12);
  }

  const goalNearRatio = clamp(0.9 - goalBuffer * 0.4, 0.82, 0.9);

  return {
    cardWarn,
    cardCritical,
    expenseThreshold,
    expenseHighThreshold,
    goalBuffer,
    goalNearRatio,
  };
}

function buildAlerts(ym, profile) {
  const alertProfile = profile || buildAlertProfile(ym);
  const alerts = [];
  const usageByCard = chargesByCard(ym);

  state.cartoes.forEach((card) => {
    const limit = Number(card.limiteAtual || 0);
    if (limit <= 0) return;

    const used = usageByCard[card.id] || 0;
    const pct = (used / limit) * 100;
    if (pct < alertProfile.cardWarn) return;

    let level = "medium";
    let thresholdKey = String(alertProfile.cardWarn);
    let title = `Uso elevado no cartão ${cardName(card)}`;

    if (pct >= 100) {
      level = "high";
      thresholdKey = "100";
      title = `Limite estourado em ${cardName(card)}`;
    } else if (pct >= alertProfile.cardCritical) {
      level = "high";
      thresholdKey = String(alertProfile.cardCritical);
      title = `Uso crítico no cartão ${cardName(card)}`;
    }

    alerts.push({
      key: `card-${ym}-${card.id}-${thresholdKey}`,
      level,
      title,
      text: `${Math.round(pct)}% do limite usado (${fmt(used)} de ${fmt(limit)}).`,
      tip: `Sugestão: priorize gastos no débito/PIX até aliviar a fatura (alerta a partir de ${alertProfile.cardWarn}%).`,
      target: {
        page: "cartoes",
        label: "Abrir Cartões",
        toast: "Revise limites e uso dos cartões nesta tela.",
      },
    });
  });

  const gastosMes = gastosDoMes(ym).map((gasto, index) => ({ gasto, index }));
  if (gastosMes.length) {
    const threshold = alertProfile.expenseThreshold;
    const highThreshold = alertProfile.expenseHighThreshold;

    gastosMes
      .filter((item) => item.gasto.valor >= threshold)
      .sort((a, b) => b.gasto.valor - a.gasto.valor)
      .slice(0, 3)
      .forEach((item) => {
        const member = getMembro(item.gasto.membroId);
        const highSeverity = item.gasto.valor >= highThreshold;
        alerts.push({
          key: `expense-${ym}-${item.index}-${Math.round(item.gasto.valor)}`,
          level: highSeverity ? "high" : "medium",
          title: `Gasto fora do padrão: ${item.gasto.desc}`,
          text: `${fmt(item.gasto.valor)} em ${item.gasto.cat} por ${member.nome}.`,
          tip: "Sugestão: valide se foi compra pontual ou se precisa de ajuste na categoria.",
          target: {
            page: "gastos",
            label: "Ver no Histórico",
            searchGastos: item.gasto.desc,
            toast: "Filtro aplicado no histórico para facilitar a análise.",
          },
        });
      });
  }

  const meta = metaDoMes(ym);
  if (meta > 0) {
    const data = projectionByMonth(ym);
    const projected = Number(data.projected.toFixed(2));

    if (projected > meta * (1 + alertProfile.goalBuffer)) {
      alerts.push({
        key: `goal-over-${ym}`,
        level: "high",
        title: "Projeção acima da meta",
        text: `Projeção de ${fmt(projected)} para meta de ${fmt(meta)}.`,
        tip: `Sugestão: reduzir cerca de ${fmt(projected - meta)} em gastos variáveis este mês.`,
        target: {
          page: "resumo",
          label: "Ajustar Meta",
          focusId: "meta-total",
          toast: "Você pode ajustar a meta mensal logo acima.",
        },
      });
    } else if (data.total >= meta * alertProfile.goalNearRatio && data.factor < 1) {
      alerts.push({
        key: `goal-near-${ym}`,
        level: "medium",
        title: "Meta próxima do limite",
        text: `Você já atingiu ${Math.round((data.total / meta) * 100)}% da meta mensal.`,
        tip: "Sugestão: acompanhe diariamente as categorias com maior impacto.",
        target: {
          page: "resumo",
          label: "Revisar Meta",
          focusId: "meta-total",
        },
      });
    }
  }

  const priority = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => (priority[a.level] ?? 3) - (priority[b.level] ?? 3));
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
  document.querySelectorAll(".bottom-nav-item").forEach((item) => item.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  if (btn) {
    btn.classList.add("active");
  } else {
    const autoBtn = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (autoBtn) autoBtn.classList.add("active");
  }

  const mobileBtn = document.querySelector(`.bottom-nav-item[data-page="${name}"]`);
  if (mobileBtn) mobileBtn.classList.add("active");

  const mainContent = document.getElementById("main-content");
  if (mainContent) mainContent.focus({ preventScroll: true });

  renderAll();
}

function changeMonth(delta) {
  state.viewMonth = addMonths(state.viewMonth, delta);
  document.getElementById("month-label").textContent = monthLabel(state.viewMonth);
  document.getElementById("resumo-sub").textContent = "Visão geral de " + monthLabel(state.viewMonth);
  renderAll();
}

function goToCurrentMonth() {
  const now = curYM();
  if (state.viewMonth === now) {
    showToast("Você já está no mês atual.", "info");
    return;
  }

  state.viewMonth = now;
  document.getElementById("month-label").textContent = monthLabel(state.viewMonth);
  document.getElementById("resumo-sub").textContent = "Visão geral de " + monthLabel(state.viewMonth);
  renderAll();
  showToast("Mês atual selecionado.", "success");
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

function matchQuery(parts, query) {
  const q = normText(query);
  if (!q) return true;
  return parts.some((part) => normText(part).includes(q));
}

function renderGastos() {
  const root = document.getElementById("gastos-list");
  const query = state.filters?.gastosQuery || "";

  if (!state.gastos.length) {
    root.innerHTML = '<div class="empty">Nenhum gasto ainda. Adicione o primeiro!</div>';
    return;
  }

  const filtered = state.gastos
    .map((gasto, index) => ({ gasto, index }))
    .filter(({ gasto }) => {
      const member = getMembro(gasto.membroId);
      const card = gasto.forma === "Crédito" ? cardName(getCartao(gasto.cartaoId)) : "";
      return matchQuery([gasto.desc, gasto.cat, gasto.forma, member.nome, card, monthLabel(gasto.mes)], query);
    })
    .reverse();

  if (!filtered.length) {
    root.innerHTML = '<div class="empty">Nenhum gasto encontrado para essa busca.</div>';
    return;
  }

  root.innerHTML = filtered
    .map(({ gasto, index }) => {
      const member = getMembro(gasto.membroId);
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
        <button class="btn btn-danger btn-sm" onclick="delGasto(${index})">✕</button>
      </div>`;
    })
    .join("");
}

function renderParcelas() {
  const root = document.getElementById("parcelas-list");
  const query = state.filters?.parcelasQuery || "";

  if (!state.parcelas.length) {
    root.innerHTML = '<div class="empty">Nenhuma parcela cadastrada</div>';
    return;
  }

  const filtered = state.parcelas
    .map((parcela, index) => ({ parcela, index }))
    .filter(({ parcela }) => {
      const member = getMembro(parcela.membroId);
      const card = parcela.cartaoId ? cardName(getCartao(parcela.cartaoId)) : parcela.cartao || "Cartão";
      return matchQuery([parcela.desc, member.nome, card], query);
    });

  if (!filtered.length) {
    root.innerHTML = '<div class="empty">Nenhuma parcela encontrada para essa busca.</div>';
    return;
  }

  root.innerHTML = filtered
    .map(({ parcela, index }) => {
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

function renderProjectionMeta() {
  const summary = document.getElementById("projection-summary");
  const goalStatus = document.getElementById("goal-status");
  const goalInput = document.getElementById("meta-total");

  if (!summary || !goalStatus || !goalInput) return;

  const ym = state.viewMonth;
  const data = projectionByMonth(ym);
  const projected = Number(data.projected.toFixed(2));
  const factorPct = Math.min(100, Math.round(data.factor * 100));
  const meta = metaDoMes(ym);

  if (document.activeElement !== goalInput) {
    goalInput.value = meta > 0 ? meta.toFixed(2) : "";
  }

  summary.innerHTML = `
    <div class="projection-cell">
      <span>Total acumulado</span>
      <strong>${fmt(data.total)}</strong>
    </div>
    <div class="projection-cell">
      <span>Projeção fechamento</span>
      <strong>${fmt(projected)}</strong>
    </div>
    <div class="projection-cell">
      <span>Gastos avulsos</span>
      <strong>${fmt(data.totalG)}</strong>
    </div>
    <div class="projection-cell">
      <span>Parcelas no mês</span>
      <strong>${fmt(data.totalP)}</strong>
    </div>
  `;

  if (meta <= 0) {
    goalStatus.innerHTML = '<div class="empty" style="padding:16px">Defina uma meta mensal para acompanhar risco de estouro.</div>';
    return;
  }

  const projectedPct = Math.round((projected / meta) * 100);
  const fill = Math.min(100, Math.max(0, projectedPct));
  const fillColor = projectedPct > 100 ? "var(--red)" : projectedPct >= 85 ? "var(--accent)" : "var(--green)";

  let statusText = `Ritmo atual: ${factorPct}% do mês transcorrido.`;
  if (projectedPct > 100) {
    statusText = `Atenção: projeção ${projectedPct}% da meta. Ajuste recomendado.`;
  } else if (projectedPct >= 85) {
    statusText = `Atenção moderada: projeção próxima do limite da meta.`;
  }

  goalStatus.innerHTML = `
    <div class="goal-track">
      <div class="goal-fill" style="width:${fill}%;background:${fillColor}"></div>
    </div>
    <div class="goal-meta">
      <span>Meta: ${fmt(meta)}</span>
      <span>${projectedPct}% projetado</span>
    </div>
    <div class="item-meta" style="margin-top:6px">${statusText}</div>
  `;
}

function renderAlertsCenter() {
  const activeRoot = document.getElementById("alerts-active");
  const resolvedRoot = document.getElementById("alerts-resolved");
  const activeCount = document.getElementById("alerts-active-count");
  const resolvedCount = document.getElementById("alerts-resolved-count");
  const profileRoot = document.getElementById("alerts-profile");

  if (!activeRoot || !resolvedRoot || !activeCount || !resolvedCount) return;

  const profile = buildAlertProfile(state.viewMonth);
  const alerts = buildAlerts(state.viewMonth, profile);
  const resolvedSet = new Set(state.alertasResolvidos || []);

  if (profileRoot) {
    profileRoot.textContent = `Perfil atual: cartão alerta em ${profile.cardWarn}% (crítico em ${profile.cardCritical}%) • gasto fora do padrão acima de ${fmt(
      profile.expenseThreshold
    )}.`;
  }

  alertActionMap = {};
  alerts.forEach((alert) => {
    if (alert.target) {
      alertActionMap[alert.key] = alert.target;
    }
  });

  const activeAlerts = alerts.filter((alert) => !resolvedSet.has(alert.key));
  const resolvedAlerts = alerts.filter((alert) => resolvedSet.has(alert.key));

  activeCount.textContent = `${activeAlerts.length} ativos`;
  resolvedCount.textContent = `${resolvedAlerts.length} resolvidos`;

  activeRoot.innerHTML = activeAlerts.length
    ? activeAlerts
        .map(
          (alert) => {
            const quickAction = alert.target
              ? `<button class="btn btn-sm" onclick="goToAlertTarget('${alert.key}')">${alert.target.label || "Abrir seção"}</button>`
              : "";

            return `
            <div class="alert-item level-${alert.level}">
              <div class="alert-title">${alert.title}</div>
              <div class="alert-text">${alert.text}</div>
              <div class="alert-tip">${alert.tip}</div>
              <div class="alert-actions">
                ${quickAction}
                <button class="btn btn-sm" onclick="resolveAlert('${alert.key}')">Resolver</button>
              </div>
            </div>
          `;
          }
        )
        .join("")
    : '<div class="empty" style="padding:16px">Nenhum alerta ativo neste mês.</div>';

  resolvedRoot.innerHTML = resolvedAlerts.length
    ? resolvedAlerts
        .map(
          (alert) => {
            const quickAction = alert.target
              ? `<button class="btn btn-sm" onclick="goToAlertTarget('${alert.key}')">${alert.target.label || "Abrir seção"}</button>`
              : "";

            return `
            <div class="alert-item level-${alert.level} resolved">
              <div class="alert-title">${alert.title}</div>
              <div class="alert-text">${alert.text}</div>
              <div class="alert-actions">
                ${quickAction}
                <button class="btn btn-sm" onclick="reabrirAlerta('${alert.key}')">Reativar</button>
              </div>
            </div>
          `;
          }
        )
        .join("")
    : '<div class="empty" style="padding:16px">Nenhum alerta resolvido neste mês.</div>';
}

function goToAlertTarget(key) {
  const target = alertActionMap[key];
  if (!target) return;

  const activePage = (document.querySelector(".page.active")?.id || "").replace("page-", "");
  if (target.page && activePage !== target.page) {
    showPage(target.page, null);
  }

  if (target.searchGastos !== undefined) {
    state.filters.gastosQuery = target.searchGastos;
    const gastosSearch = document.getElementById("gastos-search");
    if (gastosSearch) gastosSearch.value = target.searchGastos;
    renderGastos();
  }

  if (target.focusId) {
    const focusEl = document.getElementById(target.focusId);
    if (focusEl) {
      focusEl.focus();
      if (typeof focusEl.select === "function") focusEl.select();
    }
  }

  if (target.toast) {
    showToast(target.toast, "info");
  }
}

function saveMetaMensal() {
  const input = document.getElementById("meta-total");
  if (!input) return;

  const parsed = parseMoney(input.value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    showToast("Informe uma meta válida maior ou igual a zero.", "error");
    input.focus();
    return;
  }

  if (parsed === 0) {
    delete state.metasMensais[state.viewMonth];
    save();
    renderAll();
    showToast("Meta removida para este mês.", "info");
    return;
  }

  state.metasMensais[state.viewMonth] = Number(parsed.toFixed(2));
  save();
  renderAll();
  showToast("Meta mensal atualizada.", "success");
}

function resolveAlert(key) {
  if (!state.alertasResolvidos.includes(key)) {
    state.alertasResolvidos.push(key);
    save();
  }
  renderAlertsCenter();
  showToast("Alerta marcado como resolvido.", "info");
}

function reabrirAlerta(key) {
  state.alertasResolvidos = state.alertasResolvidos.filter((item) => item !== key);
  save();
  renderAlertsCenter();
  showToast("Alerta reativado.", "info");
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
  renderProjectionMeta();
  renderAlertsCenter();
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

function updateCartaoLimite(index) {
  const card = state.cartoes[index];
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
    showToast("Dia de fechamento e dia de vencimento devem ser diferentes.", "error");
    return;
  }

  card.fechamentoDia = fechamentoDia;
  card.vencimentoDia = vencimentoDia;

  save();
  renderAll();
  showToast("Datas do cartão atualizadas.", "success");
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
  showToast("Cartão removido.", "info");
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

function delGasto(index) {
  if (!confirm("Remover este gasto?")) return;
  state.gastos.splice(index, 1);
  save();
  renderAll();
  showToast("Gasto removido.", "info");
}

function delParcela(index) {
  if (!confirm("Remover esta parcela?")) return;
  state.parcelas.splice(index, 1);
  save();
  renderAll();
  showToast("Parcela removida.", "info");
}

function togglePago(index) {
  const parcela = state.parcelas[index];
  if (!parcela) return;

  parcela.pago = !parcela.pago;
  save();
  renderAll();
  showToast(parcela.pago ? "Parcela marcada como quitada." : "Parcela reativada.", "info");
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
  showToast("Membro e registros removidos.", "info");
}

function init() {
  try {
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

registerServiceWorker();
init();
