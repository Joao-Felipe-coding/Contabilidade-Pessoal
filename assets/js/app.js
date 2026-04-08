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
  assistantCategoryMemory: {},
  viewMonth: null,
  selectedColor: "#c9a96e",
  filters: {
    gastosQuery: "",
    parcelasQuery: "",
  },
};

const ASSISTANT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Moradia",
  "Vestuário",
  "Outro",
];

const ASSISTANT_MONTH_INDEX = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const ASSISTANT_CATEGORY_HINTS = [
  {
    cat: "Alimentação",
    keys: [
      "mercado",
      "ifood",
      "restaurante",
      "comida",
      "supermercado",
      "padaria",
      "lanche",
      "lanches",
      "lache",
      "salgado",
      "hamburguer",
      "hamburger",
      "pizza",
      "pastel",
      "sorvete",
      "cafe",
      "cafeteria",
      "almoco",
      "janta",
      "jantar",
    ],
  },
  { cat: "Transporte", keys: ["uber", "99", "onibus", "ônibus", "combustivel", "combustível", "gasolina", "transporte"] },
  { cat: "Saúde", keys: ["farmacia", "farmácia", "consulta", "remedio", "remédio", "saude", "saúde"] },
  { cat: "Educação", keys: ["curso", "escola", "faculdade", "educacao", "educação", "livro"] },
  { cat: "Lazer", keys: ["cinema", "viagem", "jogo", "lazer", "show", "bar"] },
  { cat: "Moradia", keys: ["aluguel", "condominio", "condomínio", "energia", "agua", "água", "internet", "moradia"] },
  { cat: "Vestuário", keys: ["roupa", "tenis", "tênis", "vestuario", "vestuário", "calcado", "calçado"] },
];

const ASSISTANT_LEARN_STOPWORDS = [
  "adicionar",
  "registrar",
  "lancar",
  "lancamento",
  "novo",
  "nova",
  "gasto",
  "despesa",
  "parcela",
  "parcelas",
  "compra",
  "valor",
  "total",
  "categoria",
  "membro",
  "cartao",
  "credito",
  "debito",
  "dinheiro",
  "pix",
  "mes",
  "atual",
  "inicio",
  "agora",
  "para",
  "com",
  "sem",
  "pelo",
  "pela",
  "este",
  "essa",
  "isso",
  "uma",
  "uns",
  "umas",
  "que",
  "foi",
  "dos",
  "das",
  "nos",
  "nas",
  "por",
  "dia",
  "pago",
  "paguei",
  "comprou",
  "compramos",
  "comprar",
  "de",
  "do",
  "da",
  "em",
  "no",
  "na",
];

const ASSISTANT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
const ASSISTANT_GEMINI_API_KEY = "AIzaSyCIJ1PzRPQ_VtzATTQAavuksaw9muDUU5g";

let assistantState = {
  messages: [],
  pendingDraft: null,
  formValues: {},
  isBusy: false,
  activeGeminiModel: ASSISTANT_GEMINI_MODELS[0],
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

function openConfirmDialog(message, onConfirm) {
  const modal = document.getElementById("confirm-modal");
  const messageEl = document.getElementById("confirm-message");
  const okButton = document.getElementById("confirm-ok");
  const cancelButton = document.getElementById("confirm-cancel");

  if (!modal || !messageEl || !okButton || !cancelButton) {
    if (window.confirm(message) && typeof onConfirm === "function") {
      onConfirm();
    }
    return;
  }

  if (modal.classList.contains("active")) return;

  messageEl.textContent = message;

  const close = (confirmed) => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    document.removeEventListener("keydown", onKeyDown);
    modal.removeEventListener("click", onBackdropClick);
    okButton.removeEventListener("click", onOkClick);
    cancelButton.removeEventListener("click", onCancelClick);

    if (confirmed && typeof onConfirm === "function") {
      onConfirm();
    }
  };

  const onOkClick = () => close(true);
  const onCancelClick = () => close(false);
  const onBackdropClick = (event) => {
    if (event.target === modal) close(false);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(false);
    }
  };

  document.addEventListener("keydown", onKeyDown);
  modal.addEventListener("click", onBackdropClick);
  okButton.addEventListener("click", onOkClick);
  cancelButton.addEventListener("click", onCancelClick);

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  okButton.focus();
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
      assistantCategoryMemory: state.assistantCategoryMemory,
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
    if (parsed.assistantCategoryMemory) state.assistantCategoryMemory = parsed.assistantCategoryMemory;
  } catch (_e) {
    state = {
      membros: [{ id: 1, nome: "Eu", cor: "#c9a96e" }],
      gastos: [],
      parcelas: [],
      cartoes: [],
      metasMensais: {},
      alertasResolvidos: [],
      assistantCategoryMemory: {},
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
          id: Number(raw?.id) || uid(),
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
          id: Number(raw?.id) || uid(),
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

  const categoryMemory =
    state.assistantCategoryMemory && typeof state.assistantCategoryMemory === "object" && !Array.isArray(state.assistantCategoryMemory)
      ? state.assistantCategoryMemory
      : {};

  const sanitizedMemory = {};
  Object.entries(categoryMemory).forEach(([token, categoryMap]) => {
    const normalizedToken = normText(token).replace(/[^a-z0-9]/g, "");
    if (normalizedToken.length < 4 || normalizedToken.length > 30) return;
    if (!categoryMap || typeof categoryMap !== "object" || Array.isArray(categoryMap)) return;

    const cleanCategoryMap = {};
    ASSISTANT_CATEGORIES.forEach((category) => {
      const weight = Number(categoryMap[category]);
      if (Number.isFinite(weight) && weight > 0) {
        cleanCategoryMap[category] = Number(weight.toFixed(3));
      }
    });

    if (Object.keys(cleanCategoryMap).length) {
      sanitizedMemory[normalizedToken] = cleanCategoryMap;
    }
  });

  state.assistantCategoryMemory = sanitizedMemory;
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

function syncMonthUI() {
  const label = monthLabel(state.viewMonth);

  const monthLabelDesktop = document.getElementById("month-label");
  if (monthLabelDesktop) monthLabelDesktop.textContent = label;

  const monthLabelTablet = document.getElementById("tablet-month-label");
  if (monthLabelTablet) monthLabelTablet.textContent = label;

  const monthLabelMobile = document.getElementById("mobile-month-label");
  if (monthLabelMobile) monthLabelMobile.textContent = label;

  const resumoSub = document.getElementById("resumo-sub");
  if (resumoSub) resumoSub.textContent = "Visão geral de " + label;
}

function showPage(name, btn) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((button) => button.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".tablet-nav-item").forEach((item) => item.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  const desktopBtn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (desktopBtn) desktopBtn.classList.add("active");

  const mobileBtn = document.querySelector(`.bottom-nav-item[data-page="${name}"]`);
  if (mobileBtn) mobileBtn.classList.add("active");

  const tabletBtn = document.querySelector(`.tablet-nav-item[data-page="${name}"]`);
  if (tabletBtn) tabletBtn.classList.add("active");

  if (btn && btn.classList) {
    btn.classList.add("active");
  }

  const mainContent = document.getElementById("main-content");
  if (mainContent) mainContent.focus({ preventScroll: true });

  renderAll();
}

function changeMonth(delta) {
  state.viewMonth = addMonths(state.viewMonth, delta);
  syncMonthUI();
  renderAll();
}

function goToCurrentMonth() {
  const now = curYM();
  if (state.viewMonth === now) {
    showToast("Você já está no mês atual.", "info");
    return;
  }

  state.viewMonth = now;
  syncMonthUI();
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
    .filter((gasto) => {
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
    .map((gasto) => {
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
        <button class="btn btn-danger btn-sm" onclick="delGasto(${gasto.id})" aria-label="Remover gasto">✕</button>
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

  const filtered = state.parcelas.filter((parcela) => {
      const member = getMembro(parcela.membroId);
      const card = parcela.cartaoId ? cardName(getCartao(parcela.cartaoId)) : parcela.cartao || "Cartão";
      return matchQuery([parcela.desc, member.nome, card], query);
    });

  if (!filtered.length) {
    root.innerHTML = '<div class="empty">Nenhuma parcela encontrada para essa busca.</div>';
    return;
  }

  root.innerHTML = filtered
    .map((parcela) => {
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
          <button class="btn btn-sm" onclick="togglePago(${parcela.id})">${parcela.pago ? "Reativar" : "Marcar quitado"}</button>
          <button class="btn btn-danger btn-sm" onclick="delParcela(${parcela.id})">Remover</button>
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
    .map((card) => {
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
          <button class="btn btn-sm btn-primary" onclick="updateCartaoLimite(${card.id})">Atualizar limite</button>
          <button class="btn btn-sm" onclick="editCartaoDatas(${card.id})">Editar datas</button>
          <button class="btn btn-danger btn-sm" onclick="delCartao(${card.id})">Remover</button>
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
                  ? `<button class="btn btn-danger btn-sm" onclick="delMembro(${member.id})">Remover</button>`
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

function assistantEl(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setAssistantBusy(isBusy) {
  assistantState.isBusy = Boolean(isBusy);

  const input = assistantEl("ai-input");
  if (input) input.disabled = assistantState.isBusy;

  const sendButton = assistantEl("ai-send-btn");
  if (sendButton) {
    sendButton.disabled = assistantState.isBusy;
    sendButton.textContent = assistantState.isBusy ? "Pensando..." : "Enviar";
  }
}

function assistantPushMessage(role, text) {
  assistantState.messages.push({ role, text: String(text || "") });
  if (assistantState.messages.length > 60) {
    assistantState.messages = assistantState.messages.slice(-60);
  }
  renderAssistantPanel();
}

function formatDraftType(type) {
  if (type === "registrar_parcela") return "Nova parcela";
  if (type === "registrar_cartao") return "Novo cartão";
  if (type === "registrar_membro") return "Novo membro";
  return "Novo gasto";
}

function mapMissingFieldLabel(field) {
  const labels = {
    descricao: "descrição",
    nome: "nome",
    cor: "cor",
    valor: "valor",
    cartao: "cartão",
    cartaoId: "cartão",
    bancoId: "banco",
    limiteAtual: "limite atual",
    fechamentoDia: "dia de fechamento",
    vencimentoDia: "dia de vencimento",
    valorTotal: "valor total",
    numeroParcelas: "número de parcelas",
    parcelaAtual: "parcela atual",
    membroId: "membro",
    mes: "mês",
    inicio: "mês de início",
    formaPagamento: "forma de pagamento",
  };
  return labels[field] || field;
}

function assistantDraftSchema(type) {
  if (type === "registrar_parcela") {
    return [
      { key: "descricao", label: "Descrição", kind: "text", placeholder: "Ex: Notebook Dell" },
      { key: "valorTotal", label: "Valor total (R$)", kind: "number", step: "0.01", min: "0" },
      { key: "numeroParcelas", label: "Número de parcelas", kind: "number", step: "1", min: "1" },
      { key: "parcelaAtual", label: "Parcela atual", kind: "number", step: "1", min: "1" },
      { key: "membroId", label: "Membro", kind: "select" },
      { key: "cartaoId", label: "Cartão", kind: "select" },
      { key: "inicio", label: "Mês de início", kind: "month" },
    ];
  }

  if (type === "registrar_cartao") {
    return [
      { key: "bancoId", label: "Banco", kind: "select" },
      { key: "apelido", label: "Apelido (opcional)", kind: "text", placeholder: "Ex: Nubank Principal" },
      { key: "limiteAtual", label: "Limite atual (R$)", kind: "number", step: "0.01", min: "0" },
      { key: "fechamentoDia", label: "Dia de fechamento", kind: "number", step: "1", min: "1" },
      { key: "vencimentoDia", label: "Dia de vencimento", kind: "number", step: "1", min: "1" },
    ];
  }

  if (type === "registrar_membro") {
    return [
      { key: "nome", label: "Nome", kind: "text", placeholder: "Ex: Maria" },
      { key: "cor", label: "Cor", kind: "select" },
    ];
  }

  return [
    { key: "descricao", label: "Descrição", kind: "text", placeholder: "Ex: Mercado" },
    { key: "valor", label: "Valor (R$)", kind: "number", step: "0.01", min: "0" },
    { key: "membroId", label: "Membro", kind: "select" },
    { key: "categoria", label: "Categoria", kind: "select" },
    { key: "mes", label: "Mês de referência", kind: "month" },
    { key: "formaPagamento", label: "Forma de pagamento", kind: "select" },
    { key: "cartaoId", label: "Cartão (se crédito)", kind: "select" },
  ];
}

function assistantGetSelectOptions(type, key) {
  if (key === "membroId") {
    return state.membros.map((member) => ({ value: String(member.id), label: member.nome }));
  }

  if (key === "bancoId") {
    return [{ value: "", label: "Selecione o banco" }].concat(BANKS.map((bank) => ({ value: bank.id, label: bank.nome })));
  }

  if (key === "cor") {
    return COLORS.map((color, index) => ({ value: color, label: `Cor ${index + 1} (${color})` }));
  }

  if (key === "categoria") {
    return ASSISTANT_CATEGORIES.map((category) => ({ value: category, label: category }));
  }

  if (key === "formaPagamento") {
    return ["Dinheiro", "Débito", "PIX", "Crédito"].map((item) => ({ value: item, label: item }));
  }

  if (key === "cartaoId") {
    const placeholder = type === "registrar_parcela" ? "Selecione o cartão" : "Sem cartão";
    return [{ value: "", label: placeholder }].concat(
      state.cartoes.map((card) => ({ value: String(card.id), label: cardName(card) }))
    );
  }

  return [];
}

function assistantFieldIsMissing(type, key, values) {
  const value = values[key];

  if (key === "nome") {
    return !String(value || "").trim();
  }

  if (key === "cor") {
    return !String(value || "").trim();
  }

  if (key === "descricao") {
    return !String(value || "").trim();
  }

  if (key === "bancoId") {
    return !String(value || "").trim();
  }

  if (key === "limiteAtual") {
    const parsed = parseMoney(value);
    return !Number.isFinite(parsed) || parsed < 0;
  }

  if (key === "valor") {
    const parsed = parseMoney(value);
    return !Number.isFinite(parsed) || parsed <= 0;
  }

  if (key === "valorTotal") {
    const parsed = parseMoney(value);
    return !Number.isFinite(parsed) || parsed <= 0;
  }

  if (key === "numeroParcelas") {
    const parsed = parseInt(value, 10);
    return !Number.isFinite(parsed) || parsed <= 0;
  }

  if (key === "fechamentoDia" || key === "vencimentoDia") {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) return true;

    if (type === "registrar_cartao") {
      const fechamento = parseInt(values.fechamentoDia, 10);
      const vencimento = parseInt(values.vencimentoDia, 10);
      if (Number.isFinite(fechamento) && Number.isFinite(vencimento) && fechamento === vencimento) {
        return true;
      }
    }

    return false;
  }

  if (key === "cartaoId") {
    if (type === "registrar_parcela") return !value;
    return values.formaPagamento === "Crédito" && !value;
  }

  if (key === "membroId") {
    return !value;
  }

  return false;
}

function assistantGetMissingFields(type, values) {
  const fields = [];

  assistantDraftSchema(type).forEach((field) => {
    if (assistantFieldIsMissing(type, field.key, values)) {
      if (field.key === "cartaoId") {
        fields.push("cartao");
      } else {
        fields.push(field.key);
      }
    }
  });

  return Array.from(new Set(fields));
}

function assistantBuildInitialFormValues(draft) {
  const prompt = draft?.prompt || {};

  if (draft?.type === "registrar_cartao") {
    const bankId = resolveBankIdFromPrompt(prompt);
    const limitRaw = prompt.limiteAtual ?? prompt.limite;
    const limitParsed = parseMoney(limitRaw);
    const fechamentoRaw = parseInt(prompt.fechamentoDia ?? prompt.fechamento, 10);
    const vencimentoRaw = parseInt(prompt.vencimentoDia ?? prompt.vencimento, 10);

    return {
      bancoId: bankId || "",
      apelido: String(prompt.apelido || "").trim(),
      limiteAtual: Number.isFinite(limitParsed) ? String(limitParsed) : "",
      fechamentoDia: Number.isFinite(fechamentoRaw) ? String(safeDay(fechamentoRaw, 7)) : "7",
      vencimentoDia: Number.isFinite(vencimentoRaw) ? String(safeDay(vencimentoRaw, 15)) : "15",
    };
  }

  if (draft?.type === "registrar_membro") {
    const color = resolveColorFromPrompt(prompt.cor || prompt.color) || state.selectedColor || COLORS[0];
    return {
      nome: String(prompt.nome || prompt.membro || "").trim(),
      cor: color,
    };
  }

  if (draft?.type === "registrar_parcela") {
    const membro = resolveMembroFromPrompt(prompt);
    const cartao = resolveCartaoFromPrompt(prompt);
    const total = Number(prompt.numeroParcelas);
    const totalSafe = Number.isFinite(total) && total > 0 ? Math.round(total) : "";
    const atual = Number(prompt.parcelaAtual);

    return {
      descricao: String(prompt.descricao || ""),
      valorTotal: Number.isFinite(Number(prompt.valorTotal)) ? String(prompt.valorTotal) : "",
      numeroParcelas: totalSafe ? String(totalSafe) : "",
      parcelaAtual: Number.isFinite(atual) && atual > 0 ? String(Math.round(atual)) : "1",
      membroId: membro ? String(membro.id) : String(state.membros[0]?.id || ""),
      cartaoId: cartao ? String(cartao.id) : "",
      inicio: validYM(prompt.inicio) || state.viewMonth || curYM(),
    };
  }

  const membro = resolveMembroFromPrompt(prompt);
  const cartao = resolveCartaoFromPrompt(prompt);
  const formaPagamento = normalizeFormaFromPrompt(prompt.formaPagamento || prompt.forma);

  return {
    descricao: String(prompt.descricao || ""),
    valor: Number.isFinite(Number(prompt.valor)) ? String(prompt.valor) : "",
    membroId: membro ? String(membro.id) : String(state.membros[0]?.id || ""),
    categoria: normalizeCategoriaFromPrompt(prompt.categoria || prompt.cat),
    mes: validYM(prompt.mes) || state.viewMonth || curYM(),
    formaPagamento,
    cartaoId: formaPagamento === "Crédito" && cartao ? String(cartao.id) : "",
  };
}

function assistantUpdateDraftField(key, value) {
  if (!assistantState.pendingDraft) return;

  assistantState.formValues[key] = value;

  if (assistantState.pendingDraft.type === "registrar_gasto" && key === "formaPagamento" && value !== "Crédito") {
    assistantState.formValues.cartaoId = "";
  }

  if (assistantState.pendingDraft.type === "registrar_parcela" && key === "numeroParcelas") {
    const total = parseInt(value, 10);
    const atual = parseInt(assistantState.formValues.parcelaAtual, 10) || 1;
    if (Number.isFinite(total) && total > 0) {
      assistantState.formValues.parcelaAtual = String(clamp(atual, 1, total));
    }
  }

  renderAssistantPanel();
}

function assistantCollectFormValues() {
  if (!assistantState.pendingDraft) return {};

  const values = { ...assistantState.formValues };
  const schema = assistantDraftSchema(assistantState.pendingDraft.type);

  schema.forEach((field) => {
    const input = assistantEl(`ai-field-${field.key}`);
    if (input) {
      values[field.key] = input.value;
    }
  });

  values.descricao = String(values.descricao || "").trim();
  values.nome = String(values.nome || "").trim();
  values.apelido = String(values.apelido || "").trim();

  if (assistantState.pendingDraft.type === "registrar_gasto" && values.formaPagamento !== "Crédito") {
    values.cartaoId = "";
  }

  if (assistantState.pendingDraft.type === "registrar_cartao") {
    values.fechamentoDia = String(safeDay(values.fechamentoDia, 7));
    values.vencimentoDia = String(safeDay(values.vencimentoDia, 15));
  }

  if (assistantState.pendingDraft.type === "registrar_parcela") {
    const total = parseInt(values.numeroParcelas, 10);
    const atual = parseInt(values.parcelaAtual, 10);

    if (Number.isFinite(total) && total > 0) {
      if (!Number.isFinite(atual) || atual < 1) {
        values.parcelaAtual = "1";
      } else if (atual > total) {
        values.parcelaAtual = String(total);
      }
    }
  }

  assistantState.formValues = values;
  return values;
}

function assistantBuildPromptFromForm(type, values) {
  if (type === "registrar_cartao") {
    return {
      acao: "registrar_cartao",
      bancoId: String(values.bancoId || "").trim(),
      apelido: String(values.apelido || "").trim(),
      limiteAtual: Number(parseMoney(values.limiteAtual)),
      fechamentoDia: safeDay(values.fechamentoDia, 7),
      vencimentoDia: safeDay(values.vencimentoDia, 15),
    };
  }

  if (type === "registrar_membro") {
    return {
      acao: "registrar_membro",
      nome: String(values.nome || "").trim(),
      cor: resolveColorFromPrompt(values.cor) || COLORS[0],
    };
  }

  if (type === "registrar_parcela") {
    return {
      acao: "registrar_parcela",
      descricao: String(values.descricao || "").trim(),
      valorTotal: Number(parseMoney(values.valorTotal)),
      numeroParcelas: Math.max(1, parseInt(values.numeroParcelas, 10) || 1),
      parcelaAtual: Math.max(1, parseInt(values.parcelaAtual, 10) || 1),
      membroId: Number(values.membroId || state.membros[0]?.id || 0),
      cartaoId: values.cartaoId ? Number(values.cartaoId) : null,
      inicio: validYM(values.inicio) || state.viewMonth || curYM(),
    };
  }

  const formaPagamento = normalizeFormaFromPrompt(values.formaPagamento);
  return {
    acao: "registrar_gasto",
    descricao: String(values.descricao || "").trim(),
    valor: Number(parseMoney(values.valor)),
    membroId: Number(values.membroId || state.membros[0]?.id || 0),
    categoria: normalizeCategoriaFromPrompt(values.categoria),
    mes: validYM(values.mes) || state.viewMonth || curYM(),
    formaPagamento,
    cartaoId: formaPagamento === "Crédito" && values.cartaoId ? Number(values.cartaoId) : null,
  };
}

function assistantFocusFirstDraftField(preferMissing) {
  if (!assistantState.pendingDraft) return;

  const type = assistantState.pendingDraft.type;
  const values = assistantCollectFormValues();
  const schema = assistantDraftSchema(type);

  let target = schema[0]?.key;
  if (preferMissing) {
    const firstMissing = schema.find((field) => assistantFieldIsMissing(type, field.key, values));
    if (firstMissing) target = firstMissing.key;
  }

  const field = assistantEl(`ai-field-${target}`);
  if (field) field.focus();
}

function renderAssistantPanel() {
  const log = assistantEl("ai-chat-log");
  if (!log) return;

  log.innerHTML = assistantState.messages
    .map((msg) => {
      const cls = msg.role === "user" ? "ai-msg ai-msg-user" : "ai-msg ai-msg-assistant";
      return `<div class="${cls}">${escapeHtml(msg.text).replace(/\n/g, "<br>")}</div>`;
    })
    .join("");

  log.scrollTop = log.scrollHeight;

  const draftBox = assistantEl("ai-draft-box");
  const draftType = assistantEl("ai-draft-type");
  const draftSummary = assistantEl("ai-draft-summary");
  const draftMissing = assistantEl("ai-draft-missing");
  const draftForm = assistantEl("ai-draft-form");

  const hasDraft = Boolean(assistantState.pendingDraft);
  if (draftBox) draftBox.hidden = !hasDraft;
  if (!hasDraft) return;

  const type = assistantState.pendingDraft.type;
  if (draftType) draftType.textContent = formatDraftType(type);

  const values = assistantCollectFormValues();
  const missing = assistantGetMissingFields(type, values);

  if (draftSummary) {
    draftSummary.textContent = "Estes são os campos que a IA preencheu com base na sua frase. Você pode corrigir qualquer valor antes de confirmar.";
  }

  if (draftMissing) {
    draftMissing.textContent = missing.length
      ? `Ainda faltam: ${missing.map(mapMissingFieldLabel).join(", ")}.`
      : "Todos os campos obrigatórios foram preenchidos.";
  }

  if (!draftForm) return;

  draftForm.innerHTML = assistantDraftSchema(type)
    .map((field) => {
      const fieldValue = values[field.key] ?? "";
      const isMissing = assistantFieldIsMissing(type, field.key, values);
      const stateClass = isMissing ? "ai-field-state ai-field-missing" : "ai-field-state ai-field-ok";
      const stateText = isMissing ? "faltando" : "preenchido";
      const rowClass = isMissing ? "ai-field is-missing" : "ai-field";
      const isDisabled = type === "registrar_gasto" && field.key === "cartaoId" && values.formaPagamento !== "Crédito";

      if (field.kind === "select") {
        const options = assistantGetSelectOptions(type, field.key)
          .map((option) => {
            const selected = String(option.value) === String(fieldValue) ? " selected" : "";
            return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
          })
          .join("");

        return `
          <div class="${rowClass}">
            <div class="ai-field-head">
              <span class="ai-field-label">${field.label}</span>
              <span class="${stateClass}">${stateText}</span>
            </div>
            <select id="ai-field-${field.key}" onchange="assistantUpdateDraftField('${field.key}', this.value)"${
              isDisabled ? " disabled" : ""
            }>${options}</select>
          </div>
        `;
      }

      return `
        <div class="${rowClass}">
          <div class="ai-field-head">
            <span class="ai-field-label">${field.label}</span>
            <span class="${stateClass}">${stateText}</span>
          </div>
          <input id="ai-field-${field.key}" type="${field.kind}" value="${escapeHtml(fieldValue)}"${
            field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ""
          }${field.step ? ` step="${field.step}"` : ""}${field.min ? ` min="${field.min}"` : ""} onchange="assistantUpdateDraftField('${
            field.key
          }', this.value)">
        </div>
      `;
    })
    .join("");
}

function parseMonthHint(text, fallbackYm) {
  const raw = String(text || "");
  const normalized = normText(raw);
  const fallback = validYM(fallbackYm) || curYM();

  const ymIso = raw.match(/\b(\d{4})-(\d{2})\b/);
  if (ymIso) {
    const ym = `${ymIso[1]}-${ymIso[2]}`;
    return validYM(ym) || fallback;
  }

  const mmYYYY = raw.match(/\b(\d{1,2})[\/-](\d{4})\b/);
  if (mmYYYY) {
    const month = String(clamp(Number(mmYYYY[1]), 1, 12)).padStart(2, "0");
    return `${mmYYYY[2]}-${month}`;
  }

  if (normalized.includes("mes que vem") || normalized.includes("proximo mes")) {
    return addMonths(fallback, 1);
  }
  if (normalized.includes("mes passado") || normalized.includes("mes anterior")) {
    return addMonths(fallback, -1);
  }
  if (normalized.includes("mes atual") || normalized.includes("este mes") || normalized.includes("agora")) {
    return curYM();
  }

  const monthName = Object.keys(ASSISTANT_MONTH_INDEX).find((name) => normalized.includes(name));
  if (monthName) {
    const yearMatch = normalized.match(new RegExp(`${monthName}\\s*(de\\s*)?(\\d{4})`));
    const year = yearMatch ? Number(yearMatch[2]) : Number(fallback.split("-")[0]);
    const month = String(ASSISTANT_MONTH_INDEX[monthName]).padStart(2, "0");
    return `${year}-${month}`;
  }

  return fallback;
}

function extractQuotedText(text) {
  const quoted = String(text || "").match(/[\"“](.+?)[\"”]/);
  return quoted ? quoted[1].trim() : "";
}

function extractMoneyCandidates(text) {
  const values = [];
  const regex = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|(?:r\$\s*)?\d+(?:[.,]\d{1,2})?/gi;
  let match = regex.exec(text);

  while (match) {
    const raw = match[0];
    const parsed = parseMoney(raw.replace(/r\$/gi, ""));
    const likelyYear = parsed >= 1900 && parsed <= 2100 && !/r\$/i.test(raw);

    if (Number.isFinite(parsed) && parsed > 0 && !likelyYear) {
      values.push({ value: Number(parsed.toFixed(2)), raw, index: match.index });
    }

    match = regex.exec(text);
  }

  return values;
}

function levenshteinDistance(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const dp = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[left.length][right.length];
}

function fuzzyTokenCategoryScore(token, keyword) {
  const t = normText(token);
  const k = normText(keyword);
  if (!t || !k) return 0;
  if (t === k) return 1;

  if (t.length >= 4 && k.length >= 4 && (t.includes(k) || k.includes(t))) {
    return 0.93;
  }

  if (t.length < 4 || k.length < 4) return 0;
  if (t[0] !== k[0]) return 0;

  const maxLen = Math.max(t.length, k.length);
  const distance = levenshteinDistance(t, k);
  const similarity = 1 - distance / maxLen;

  const threshold = maxLen <= 5 ? 0.75 : 0.66;
  return similarity >= threshold ? similarity : 0;
}

function extractMeaningfulTokens(text) {
  const normalized = normText(text).replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  return Array.from(new Set(tokens));
}

function extractLearnableTokens(text) {
  return extractMeaningfulTokens(text)
    .map((token) => normText(token).replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 4 && token.length <= 24)
    .filter((token) => !ASSISTANT_LEARN_STOPWORDS.includes(token))
    .filter((token) => !/^\d+$/.test(token));
}

function pruneAssistantCategoryMemory(maxTokens) {
  const memoryEntries = Object.entries(state.assistantCategoryMemory || {});
  if (memoryEntries.length <= maxTokens) return;

  const weighted = memoryEntries
    .map(([token, categoryMap]) => {
      const total = Object.values(categoryMap || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
      return { token, total };
    })
    .sort((a, b) => b.total - a.total);

  const keep = new Set(weighted.slice(0, maxTokens).map((item) => item.token));
  Object.keys(state.assistantCategoryMemory).forEach((token) => {
    if (!keep.has(token)) {
      delete state.assistantCategoryMemory[token];
    }
  });
}

function learnCategoryFromDescription(description, category) {
  const normalizedCategory = ASSISTANT_CATEGORIES.find((item) => normText(item) === normText(category));
  if (!normalizedCategory || normalizedCategory === "Outro") return false;

  const tokens = extractLearnableTokens(description);
  if (!tokens.length) return false;

  if (!state.assistantCategoryMemory || typeof state.assistantCategoryMemory !== "object" || Array.isArray(state.assistantCategoryMemory)) {
    state.assistantCategoryMemory = {};
  }

  tokens.forEach((token) => {
    const current =
      state.assistantCategoryMemory[token] && typeof state.assistantCategoryMemory[token] === "object"
        ? state.assistantCategoryMemory[token]
        : {};

    const next = {};
    Object.entries(current).forEach(([cat, weight]) => {
      const numeric = Number(weight);
      if (!ASSISTANT_CATEGORIES.includes(cat) || !Number.isFinite(numeric) || numeric <= 0) return;

      if (cat === normalizedCategory) {
        next[cat] = numeric;
        return;
      }

      const cooled = Number((numeric * 0.92).toFixed(3));
      if (cooled >= 0.2) {
        next[cat] = cooled;
      }
    });

    next[normalizedCategory] = Number(((next[normalizedCategory] || 0) + 1).toFixed(3));
    state.assistantCategoryMemory[token] = next;
  });

  pruneAssistantCategoryMemory(180);
  return true;
}

function inferCategoriaFromLearnedMemory(text) {
  if (!state.assistantCategoryMemory || typeof state.assistantCategoryMemory !== "object") return null;

  const memoryEntries = Object.entries(state.assistantCategoryMemory);
  if (!memoryEntries.length) return null;

  const tokens = extractLearnableTokens(text);
  if (!tokens.length) return null;

  const scoreByCategory = {};

  tokens.forEach((token) => {
    memoryEntries.forEach(([learnedToken, categoryMap]) => {
      const similarity = token === learnedToken ? 1 : fuzzyTokenCategoryScore(token, learnedToken);
      if (similarity <= 0) return;

      Object.entries(categoryMap || {}).forEach(([category, weight]) => {
        const numeric = Number(weight);
        if (!ASSISTANT_CATEGORIES.includes(category) || !Number.isFinite(numeric) || numeric <= 0) return;
        scoreByCategory[category] = (scoreByCategory[category] || 0) + similarity * numeric;
      });
    });
  });

  const ranked = Object.entries(scoreByCategory)
    .filter(([category]) => category !== "Outro")
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length) return null;
  const [bestCategory, bestScore] = ranked[0];
  return bestScore >= 1.35 ? bestCategory : null;
}

function inferCategoria(text) {
  const normalized = normText(text);
  const direct = ASSISTANT_CATEGORIES.find((cat) => normalized.includes(normText(cat)));
  if (direct) return direct;

  const learned = inferCategoriaFromLearnedMemory(text);
  if (learned) return learned;

  for (const item of ASSISTANT_CATEGORY_HINTS) {
    if (item.keys.some((key) => normalized.includes(normText(key)))) {
      return item.cat;
    }
  }

  const tokens = extractMeaningfulTokens(text);
  let bestCategory = "Outro";
  let bestScore = 0;

  ASSISTANT_CATEGORY_HINTS.forEach((item) => {
    item.keys.forEach((key) => {
      tokens.forEach((token) => {
        const score = fuzzyTokenCategoryScore(token, key);
        if (score > bestScore) {
          bestScore = score;
          bestCategory = item.cat;
        }
      });
    });
  });

  if (bestScore >= 0.74) {
    return bestCategory;
  }

  return "Outro";
}

function inferFormaPagamento(text) {
  const normalized = normText(text);
  if (normalized.includes("credito") || normalized.includes("cartao")) return "Crédito";
  if (normalized.includes("pix")) return "PIX";
  if (normalized.includes("debito")) return "Débito";
  if (normalized.includes("dinheiro") || normalized.includes("especie")) return "Dinheiro";
  return "Dinheiro";
}

function inferMembro(text) {
  const normalized = normText(text);
  const ordered = [...state.membros].sort((a, b) => b.nome.length - a.nome.length);
  return ordered.find((member) => normalized.includes(normText(member.nome))) || state.membros[0] || null;
}

function inferCartao(text) {
  const normalized = normText(text);
  const card = state.cartoes.find((item) => {
    const byAlias = normText(cardName(item));
    const byBank = normText(findBank(item.bancoId).nome);
    return normalized.includes(byAlias) || normalized.includes(byBank);
  });

  if (card) return card;
  if ((normalized.includes("credito") || normalized.includes("cartao")) && state.cartoes.length === 1) {
    return state.cartoes[0];
  }

  return null;
}

function inferDescricao(text) {
  const quoted = extractQuotedText(text);
  if (quoted) return quoted;

  let cleaned = String(text || "");

  cleaned = cleaned.replace(/r\$\s*\d[\d.,]*/gi, " ");
  cleaned = cleaned.replace(/\b\d+\s*\/\s*\d+\b/g, " ");
  cleaned = cleaned.replace(/\b\d+\s*(?:x|parcelas?)\b/gi, " ");
  cleaned = cleaned.replace(/\b\d{1,2}[\/-]\d{4}\b/g, " ");
  cleaned = cleaned.replace(/\b\d{4}-\d{2}\b/g, " ");

  state.membros.forEach((member) => {
    const regex = new RegExp(`\\b${escapeRegex(member.nome)}\\b`, "gi");
    cleaned = cleaned.replace(regex, " ");
  });

  state.cartoes.forEach((item) => {
    const aliasRegex = new RegExp(`\\b${escapeRegex(cardName(item))}\\b`, "gi");
    const bankRegex = new RegExp(`\\b${escapeRegex(findBank(item.bancoId).nome)}\\b`, "gi");
    cleaned = cleaned.replace(aliasRegex, " ");
    cleaned = cleaned.replace(bankRegex, " ");
  });

  cleaned = cleaned.replace(
    /\b(adicionar|registrar|lancar|lançar|incluir|novo|nova|salvar|gasto|despesa|compra|parcela|parcelado|valor|total|categoria|membro|mes|mês|inicio|início|atual|credito|crédito|debito|débito|pix|dinheiro|cartao|cartão|de|do|da|no|na|em|com|para)\b/gi,
    " "
  );

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  if (cleaned.length < 3) return "";

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractParcelaPlan(text) {
  let total = null;
  let atual = null;

  const ratio = String(text || "").match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (ratio) {
    atual = Number(ratio[1]);
    total = Number(ratio[2]);
  }

  const byX = String(text || "").match(/\b(\d{1,3})\s*x\b/i);
  if (!total && byX) total = Number(byX[1]);

  const byWord = String(text || "").match(/\b(\d{1,3})\s*parcelas?\b/i);
  if (!total && byWord) total = Number(byWord[1]);

  const atualByWord = String(text || "").match(/\b(?:parcela\s*atual|atual)\s*(\d{1,3})\b/i);
  if (!atual && atualByWord) atual = Number(atualByWord[1]);

  return {
    total: Number.isFinite(total) ? total : null,
    atual: Number.isFinite(atual) ? atual : 1,
  };
}

function detectAssistantIntent(text) {
  const normalized = normText(text);
  const hasQuestion =
    String(text || "").includes("?") ||
    ["quanto", "quantos", "qual", "quais", "faltam", "restam", "como", "quando", "futuro", "proximo"].some((term) =>
      normalized.includes(term)
    );

  if (
    ["confirmar", "confirmo", "salvar", "pode salvar", "sim salvar", "ok salvar", "confirma"].some((term) =>
      normalized === term || normalized.startsWith(term)
    )
  ) {
    return "confirmar";
  }

  if (["cancelar", "cancela", "descartar"].some((term) => normalized === term || normalized.startsWith(term))) {
    return "cancelar";
  }

  if (["editar", "alterar", "corrigir"].some((term) => normalized === term || normalized.startsWith(term))) {
    return "editar";
  }

  const hasRegisterHint = ["adicionar", "registrar", "lancar", "lançar", "incluir", "novo", "nova", "salvar"].some((term) =>
    normalized.includes(term)
  );

  const hasParcela = ["parcela", "parcelado", "parcelas", "prestacao", "prestação"].some((term) => normalized.includes(term));
  const hasGasto = ["gasto", "despesa", "compra", "paguei", "paguei"].some((term) => normalized.includes(term));
  const hasMoney = extractMoneyCandidates(text).length > 0;

  if (hasQuestion && !hasRegisterHint) return "consulta";
  if (hasParcela && (hasRegisterHint || hasMoney)) return "registrar_parcela";
  if ((hasGasto && (hasRegisterHint || hasMoney)) || (hasRegisterHint && hasMoney)) return "registrar_gasto";
  if (hasQuestion) return "consulta";
  if (hasParcela) return "registrar_parcela";
  if (hasMoney) return "registrar_gasto";

  return "consulta";
}

function buildGastoDraftFromText(text) {
  const moneyCandidates = extractMoneyCandidates(text);
  const marked = moneyCandidates.find((item) => /r\$/i.test(item.raw));
  const selected = marked || moneyCandidates[0] || null;

  const formaPagamento = inferFormaPagamento(text);
  const card = formaPagamento === "Crédito" ? inferCartao(text) : null;
  const member = inferMembro(text);
  const mes = parseMonthHint(text, state.viewMonth || curYM());

  const prompt = {
    acao: "registrar_gasto",
    descricao: inferDescricao(text),
    valor: selected ? Number(selected.value.toFixed(2)) : null,
    membroId: member?.id || null,
    membro: member?.nome || "",
    categoria: inferCategoria(text),
    mes,
    formaPagamento,
    cartaoId: card?.id || null,
    cartao: card ? cardName(card) : "",
  };

  const missing = [];
  if (!prompt.descricao) missing.push("descricao");
  if (!Number.isFinite(prompt.valor) || prompt.valor <= 0) missing.push("valor");
  if (prompt.formaPagamento === "Crédito" && !prompt.cartaoId) missing.push("cartao");

  return {
    type: "registrar_gasto",
    prompt,
    missing,
  };
}

function buildParcelaDraftFromText(text) {
  const moneyCandidates = extractMoneyCandidates(text);
  const selected = moneyCandidates.length ? moneyCandidates.sort((a, b) => b.value - a.value)[0] : null;
  const plan = extractParcelaPlan(text);
  const card = inferCartao(text);
  const member = inferMembro(text);

  const total = Number.isFinite(plan.total) ? Math.max(1, Math.round(plan.total)) : null;
  const parcelaAtual = total ? clamp(Math.round(plan.atual || 1), 1, total) : Math.max(1, Math.round(plan.atual || 1));

  const prompt = {
    acao: "registrar_parcela",
    descricao: inferDescricao(text),
    valorTotal: selected ? Number(selected.value.toFixed(2)) : null,
    numeroParcelas: total,
    parcelaAtual,
    membroId: member?.id || null,
    membro: member?.nome || "",
    cartaoId: card?.id || null,
    cartao: card ? cardName(card) : "",
    inicio: parseMonthHint(text, state.viewMonth || curYM()),
  };

  const missing = [];
  if (!prompt.descricao) missing.push("descricao");
  if (!Number.isFinite(prompt.valorTotal) || prompt.valorTotal <= 0) missing.push("valorTotal");
  if (!Number.isFinite(prompt.numeroParcelas) || prompt.numeroParcelas <= 0) missing.push("numeroParcelas");
  if (!prompt.cartaoId) missing.push("cartao");

  return {
    type: "registrar_parcela",
    prompt,
    missing,
  };
}

function setAssistantDraft(draft) {
  assistantState.pendingDraft = draft;
  assistantState.formValues = assistantBuildInitialFormValues(draft);

  const missing = assistantGetMissingFields(draft.type, assistantState.formValues);

  if (missing.length) {
    const missingLabel = missing.map(mapMissingFieldLabel).join(", ");
    assistantPushMessage(
      "assistant",
      `Interpretei um ${formatDraftType(draft.type).toLowerCase()}. Preenchi os campos do formulário e ainda faltam: ${missingLabel}.`
    );
  } else {
    assistantPushMessage(
      "assistant",
      `Interpretei um ${formatDraftType(draft.type).toLowerCase()} completo. Revise os campos e confirme para salvar.`
    );
  }

  renderAssistantPanel();
}

function toggleAssistantDraftEditor() {
  if (!assistantState.pendingDraft) {
    showToast("Nenhum registro pendente para editar.", "info");
    return;
  }

  assistantPushMessage("assistant", "Você pode editar os campos diretamente no formulário abaixo.");
  assistantFocusFirstDraftField(true);
}

function cancelAssistantDraft() {
  if (!assistantState.pendingDraft) return;

  assistantState.pendingDraft = null;
  assistantState.formValues = {};
  renderAssistantPanel();
  assistantPushMessage("assistant", "Registro cancelado. Se quiser, posso interpretar um novo lançamento.");
}

function resolveMembroFromPrompt(prompt) {
  const id = Number(prompt?.membroId);
  if (Number.isFinite(id)) {
    const byId = state.membros.find((member) => member.id === id);
    if (byId) return byId;
  }

  const name = String(prompt?.membro || "").trim();
  if (name) {
    const wanted = normText(name);
    const byName = state.membros.find((member) => normText(member.nome).includes(wanted) || wanted.includes(normText(member.nome)));
    if (byName) return byName;
  }

  return state.membros[0] || null;
}

function resolveCartaoFromPrompt(prompt) {
  const id = Number(prompt?.cartaoId);
  if (Number.isFinite(id)) {
    const byId = state.cartoes.find((card) => card.id === id);
    if (byId) return byId;
  }

  const name = String(prompt?.cartao || "").trim();
  if (name) {
    const wanted = normText(name);
    const byName = state.cartoes.find((card) => {
      const alias = normText(cardName(card));
      const bank = normText(findBank(card.bancoId).nome);
      return alias.includes(wanted) || bank.includes(wanted) || wanted.includes(alias) || wanted.includes(bank);
    });
    if (byName) return byName;
  }

  return null;
}

function resolveBankIdFromPrompt(prompt) {
  if (!prompt) return null;

  const candidates = [prompt.bancoId, prompt.bankId, prompt.banco, prompt.bank]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const byId = BANKS.find((bank) => bank.id === candidate);
    if (byId) return byId.id;

    const byName = bankFromName(candidate);
    if (byName?.id && byName.id !== "outro") return byName.id;
  }

  return null;
}

function resolveColorFromPrompt(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = normText(raw);

  const hex = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const valueHex = `#${hex[1].toLowerCase()}`;
    const exact = COLORS.find((color) => normText(color) === normText(valueHex));
    return exact || valueHex;
  }

  const colorByList = COLORS.find((color) => normText(color) === normalized);
  if (colorByList) return colorByList;

  const named = {
    dourado: COLORS[0],
    amarelo: COLORS[0],
    verde: COLORS[1],
    azul: COLORS[2],
    vermelho: COLORS[3],
    roxo: COLORS[4],
    rosa: COLORS[5],
    turquesa: COLORS[6],
    ciano: COLORS[6],
    laranja: COLORS[7],
  };

  return named[normalized] || null;
}

function normalizeCategoriaFromPrompt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Outro";

  const direct = ASSISTANT_CATEGORIES.find((cat) => normText(cat) === normText(raw));
  if (direct) return direct;

  return inferCategoria(raw);
}

function normalizeFormaFromPrompt(value) {
  const normalized = normText(value || "");
  if (normalized.includes("credito") || normalized.includes("cartao")) return "Crédito";
  if (normalized.includes("pix")) return "PIX";
  if (normalized.includes("debito")) return "Débito";
  return "Dinheiro";
}

function saveGastoFromAssistantPrompt(prompt) {
  const descricao = String(prompt?.descricao || "").trim();
  const valor = Number(prompt?.valor);
  const membro = resolveMembroFromPrompt(prompt);
  const forma = normalizeFormaFromPrompt(prompt?.formaPagamento || prompt?.forma);
  const cartao = forma === "Crédito" ? resolveCartaoFromPrompt(prompt) : null;
  const categoria = normalizeCategoriaFromPrompt(prompt?.categoria || prompt?.cat);
  const mes = validYM(prompt?.mes) || state.viewMonth || curYM();

  if (!descricao) throw new Error("Descrição obrigatória para salvar o gasto.");
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido para o gasto.");
  if (forma === "Crédito" && !cartao) throw new Error("Gasto no crédito precisa de cartão vinculado.");

  state.gastos.push({
    id: uid(),
    desc: descricao,
    valor: Number(valor.toFixed(2)),
    membroId: membro?.id || state.membros[0].id,
    cat: categoria,
    mes,
    forma,
    cartaoId: cartao ? cartao.id : null,
  });

  // Aprendizado por correção: a categoria final confirmada alimenta futuras inferências.
  learnCategoryFromDescription(descricao, categoria);

  save();
  renderAll();
}

function saveParcelaFromAssistantPrompt(prompt) {
  const descricao = String(prompt?.descricao || "").trim();
  const valorTotal = Number(prompt?.valorTotal);
  const numeroParcelas = Math.max(1, Math.round(Number(prompt?.numeroParcelas)));
  const parcelaAtual = clamp(Math.round(Number(prompt?.parcelaAtual || 1)), 1, numeroParcelas);
  const membro = resolveMembroFromPrompt(prompt);
  const cartao = resolveCartaoFromPrompt(prompt);
  const inicio = validYM(prompt?.inicio) || state.viewMonth || curYM();

  if (!descricao) throw new Error("Descrição obrigatória para salvar a parcela.");
  if (!Number.isFinite(valorTotal) || valorTotal <= 0) throw new Error("Valor total inválido para a parcela.");
  if (!Number.isFinite(numeroParcelas) || numeroParcelas <= 0) throw new Error("Número de parcelas inválido.");
  if (!cartao) throw new Error("Parcela precisa de um cartão cadastrado.");

  state.parcelas.push({
    id: uid(),
    desc: descricao,
    totalVal: Number(valorTotal.toFixed(2)),
    total: numeroParcelas,
    atual: parcelaAtual,
    membroId: membro?.id || state.membros[0].id,
    cartaoId: cartao.id,
    cartao: "",
    inicio,
    pago: false,
  });

  save();
  renderAll();
}

function saveCartaoFromAssistantPrompt(prompt) {
  const bancoId = resolveBankIdFromPrompt(prompt);
  const apelido = String(prompt?.apelido || "").trim();
  const limiteAtual = Number(prompt?.limiteAtual);
  const fechamentoDia = safeDay(prompt?.fechamentoDia, 7);
  const vencimentoDia = safeDay(prompt?.vencimentoDia, 15);

  if (!bancoId) throw new Error("Banco obrigatório para cadastrar cartão.");
  if (!Number.isFinite(limiteAtual) || limiteAtual < 0) throw new Error("Limite inválido para cartão.");
  if (fechamentoDia === vencimentoDia) {
    throw new Error("Dia de fechamento e vencimento devem ser diferentes.");
  }

  const duplicate = state.cartoes.some((card) => {
    const sameBank = card.bancoId === bancoId;
    const sameName = normText(cardName(card)) === normText(apelido || findBank(bancoId).nome);
    return sameBank && sameName;
  });

  if (duplicate) {
    throw new Error("Já existe um cartão com esse banco/nome.");
  }

  state.cartoes.push({
    id: uid(),
    bancoId,
    apelido,
    fechamentoDia,
    vencimentoDia,
    limiteAtual: Number(limiteAtual.toFixed(2)),
    limiteHistorico: [{ data: todayISO(), valor: Number(limiteAtual.toFixed(2)) }],
  });

  save();
  renderAll();
}

function saveMembroFromAssistantPrompt(prompt) {
  const nome = String(prompt?.nome || prompt?.membro || "").trim();
  const cor = resolveColorFromPrompt(prompt?.cor || prompt?.color) || state.selectedColor || COLORS[0];

  if (!nome) throw new Error("Nome obrigatório para cadastrar membro.");

  state.membros.push({
    id: uid(),
    nome,
    cor,
  });

  save();
  renderAll();
}

function confirmAssistantDraft() {
  if (!assistantState.pendingDraft) {
    showToast("Nenhum prompt pendente para confirmar.", "info");
    return;
  }

  const draftType = assistantState.pendingDraft.type;
  const values = assistantCollectFormValues();
  const missing = assistantGetMissingFields(draftType, values);

  if (missing.length) {
    const missingLabel = missing.map(mapMissingFieldLabel).join(", ");
    showToast(`Complete os campos obrigatórios: ${missingLabel}.`, "error");
    assistantPushMessage("assistant", `Antes de salvar, faltam estes campos: ${missingLabel}.`);
    renderAssistantPanel();
    assistantFocusFirstDraftField(true);
    return;
  }

  const prompt = assistantBuildPromptFromForm(draftType, values);

  try {
    if (prompt.acao === "registrar_gasto") {
      saveGastoFromAssistantPrompt(prompt);
      assistantPushMessage("assistant", "Gasto salvo com sucesso no seu histórico.");
      showToast("Registro de gasto salvo via Assistente IA.", "success");
    } else if (prompt.acao === "registrar_parcela") {
      saveParcelaFromAssistantPrompt(prompt);
      assistantPushMessage("assistant", "Parcela salva com sucesso no seu histórico.");
      showToast("Registro de parcela salvo via Assistente IA.", "success");
    } else if (prompt.acao === "registrar_cartao") {
      saveCartaoFromAssistantPrompt(prompt);
      assistantPushMessage("assistant", "Cartao salvo com sucesso.");
      showToast("Cartao cadastrado via Assistente IA.", "success");
    } else if (prompt.acao === "registrar_membro") {
      saveMembroFromAssistantPrompt(prompt);
      assistantPushMessage("assistant", "Membro salvo com sucesso.");
      showToast("Membro cadastrado via Assistente IA.", "success");
    } else {
      throw new Error("Ação do prompt não reconhecida.");
    }

    assistantState.pendingDraft = null;
    assistantState.formValues = {};
    renderAssistantPanel();
  } catch (error) {
    const message = error?.message || "Não foi possível salvar o registro pelo assistente.";
    assistantPushMessage("assistant", `Não consegui salvar: ${message}`);
    showToast(message, "error");
  }
}

function summarizeMonth(ym) {
  const data = totalsByMonth(ym);
  if (!data.gastos.length && !data.parcelas.length) {
    return `Em ${monthLabel(ym)} não há registros de gastos ou parcelas.`;
  }

  return [
    `Resumo de ${monthLabel(ym)}:`,
    `• Total: ${fmt(data.total)}`,
    `• Gastos avulsos: ${fmt(data.totalG)} (${data.gastos.length} registro(s))`,
    `• Parcelas no mês: ${fmt(data.totalP)} (${data.parcelas.length} registro(s))`,
  ].join("\n");
}

function isParcelaAtMonth(parcela, ym) {
  const end = addMonths(parcela.inicio, parcela.total - parcela.atual);
  return !parcela.pago && ym >= parcela.inicio && ym <= end;
}

function findParcelaTarget(text) {
  const quoted = extractQuotedText(text);
  const normalized = normText(text);
  let term = quoted;

  if (!term) {
    const match = normalized.match(/(?:parcela|prestacao|prestação)\s+(?:do|da|de)?\s*([a-z0-9\s-]{3,})$/i);
    if (match) term = match[1].trim();
  }

  if (term) {
    const wanted = normText(term);
    const matches = state.parcelas.filter((parcela) => normText(parcela.desc).includes(wanted));
    if (matches.length === 1) return { target: matches[0], manyMatches: false };
    if (matches.length > 1) {
      const active = matches.find((parcela) => isParcelaAtMonth(parcela, curYM()));
      return { target: active || matches[0], manyMatches: true };
    }
  }

  const activeNow = state.parcelas.filter((parcela) => isParcelaAtMonth(parcela, curYM()));
  if (activeNow.length === 1) return { target: activeNow[0], manyMatches: false };
  if (state.parcelas.length === 1) return { target: state.parcelas[0], manyMatches: false };

  return { target: null, manyMatches: activeNow.length > 1 || state.parcelas.length > 1 };
}

function answerMesesRestantesParcela(text) {
  if (!state.parcelas.length) {
    return "Você ainda não possui parcelas cadastradas para eu calcular o tempo restante.";
  }

  const result = findParcelaTarget(text);
  const parcela = result.target;

  if (!parcela) {
    return "Não consegui identificar a parcela exata. Informe o nome da compra entre aspas para eu calcular os meses restantes.";
  }

  const now = curYM();
  const endMonth = addMonths(parcela.inicio, parcela.total - parcela.atual);

  if (parcela.pago) {
    return `A parcela \"${parcela.desc}\" já está marcada como quitada.`;
  }

  if (monthDiff(now, parcela.inicio) < 0) {
    const monthsToStart = monthDiff(now, parcela.inicio);
    const monthsToEnd = monthDiff(now, endMonth);
    return `A parcela \"${parcela.desc}\" ainda não começou. Falta(m) ${monthsToStart} mês(es) para iniciar e ${monthsToEnd} mês(es) para terminar.`;
  }

  if (monthDiff(now, endMonth) < 0) {
    return `A parcela \"${parcela.desc}\" já terminou em ${monthLabel(endMonth)}.`;
  }

  const parcelaAtual = clamp(parcela.atual + monthDiff(parcela.inicio, now), 1, parcela.total);
  const restantes = Math.max(0, parcela.total - parcelaAtual);
  const monthsToEnd = Math.max(0, monthDiff(now, endMonth));

  if (!restantes) {
    return `A parcela \"${parcela.desc}\" termina neste mês (${monthLabel(endMonth)}).`;
  }

  let answer = `Para \"${parcela.desc}\", você está na parcela ${parcelaAtual}/${parcela.total}. Faltam ${restantes} parcela(s) para quitar.`;
  answer += ` Previsão de término: ${monthLabel(endMonth)} (${monthsToEnd} mês(es) até o fim).`;
  if (result.manyMatches) {
    answer += " Encontrei mais de uma parcela parecida, então usei a mais provável.";
  }
  return answer;
}

function answerTotalGastosMes(text) {
  const ym = parseMonthHint(text, state.viewMonth || curYM());
  return summarizeMonth(ym);
}

function answerProximosCompromissos(text) {
  const normalized = normText(text);
  const horizonMatch = normalized.match(/(\d{1,2})\s*mes/);
  const horizon = clamp(Number(horizonMatch?.[1] || 3), 1, 12);

  const lines = [];
  let hasValue = false;

  for (let i = 1; i <= horizon; i += 1) {
    const ym = addMonths(curYM(), i);
    const parcelas = parcelasDoMes(ym);
    const total = parcelas.reduce((sum, item) => sum + item.valorParcela, 0);
    if (total > 0) hasValue = true;
    lines.push(`• ${monthLabel(ym)}: ${fmt(total)} em ${parcelas.length} parcela(s)`);
  }

  if (!hasValue) {
    return "Não há compromissos parcelados previstos para os próximos meses com base nos dados atuais.";
  }

  return `Compromissos futuros (próximos ${horizon} mês(es)):\n${lines.join("\n")}`;
}

function answerUsoCartao(text) {
  if (!state.cartoes.length) {
    return "Você ainda não possui cartões cadastrados para eu analisar limite e uso.";
  }

  const ym = parseMonthHint(text, state.viewMonth || curYM());
  const usage = chargesByCard(ym);
  const selected = inferCartao(text);

  if (selected) {
    const used = usage[selected.id] || 0;
    const limit = Number(selected.limiteAtual || 0);
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    return `Cartão ${cardName(selected)} em ${monthLabel(ym)}: usado ${fmt(used)} de ${fmt(limit)} (${pct}%).`;
  }

  const lines = state.cartoes
    .map((card) => {
      const used = usage[card.id] || 0;
      const limit = Number(card.limiteAtual || 0);
      const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
      return { label: `• ${cardName(card)}: ${fmt(used)} / ${fmt(limit)} (${pct}%)`, used };
    })
    .sort((a, b) => b.used - a.used)
    .map((item) => item.label);

  return `Uso de cartões em ${monthLabel(ym)}:\n${lines.join("\n")}`;
}

function answerParcelasAtivas(text) {
  if (!state.parcelas.length) {
    return "Você não possui parcelas cadastradas no momento.";
  }

  const ym = parseMonthHint(text, state.viewMonth || curYM());
  const parcelas = parcelasDoMes(ym);

  if (!parcelas.length) {
    return `Nenhuma parcela ativa em ${monthLabel(ym)}.`;
  }

  const total = parcelas.reduce((sum, item) => sum + item.valorParcela, 0);
  const top = parcelas
    .slice()
    .sort((a, b) => b.valorParcela - a.valorParcela)
    .slice(0, 3)
    .map((item) => `• ${item.desc}: ${fmt(item.valorParcela)} (${item.parcelaAtual}/${item.total})`)
    .join("\n");

  return `Parcelas ativas em ${monthLabel(ym)}: ${parcelas.length} registro(s), total ${fmt(total)}.\n${top}`;
}

function answerAssistantQuery(text) {
  const normalized = normText(text);

  if ((normalized.includes("falt") || normalized.includes("rest")) && normalized.includes("parcela")) {
    return answerMesesRestantesParcela(text);
  }

  if (
    (normalized.includes("quanto") || normalized.includes("total") || normalized.includes("resumo")) &&
    (normalized.includes("gasto") || normalized.includes("gastei") || normalized.includes("despesa"))
  ) {
    return answerTotalGastosMes(text);
  }

  if (normalized.includes("futuro") || normalized.includes("proxim") || normalized.includes("vencer")) {
    return answerProximosCompromissos(text);
  }

  if (normalized.includes("cartao") || normalized.includes("cartão") || normalized.includes("fatura") || normalized.includes("limite")) {
    return answerUsoCartao(text);
  }

  if (normalized.includes("parcela") && (normalized.includes("ativa") || normalized.includes("aberta") || normalized.includes("corrente"))) {
    return answerParcelasAtivas(text);
  }

  if (normalized.includes("atual") || normalized.includes("mes")) {
    return summarizeMonth(parseMonthHint(text, state.viewMonth || curYM()));
  }

  return [
    "Posso te ajudar com registros e consultas financeiras.",
    "Exemplos úteis:",
    "• adicionar gasto de R$ 120 mercado no crédito nubank",
    "• registrar parcela notebook R$ 3600 em 12x, atual 2, no itau",
    "• quantos meses faltam para acabar a parcela \"Notebook\"?",
    "• quanto gastei no mês passado?",
    "",
    summarizeMonth(state.viewMonth || curYM()),
  ].join("\n");
}

function assistantContextSnapshot() {
  const currentMonth = state.viewMonth || curYM();
  const monthsForAvg = [0, 1, 2].map((offset) => addMonths(currentMonth, -offset));
  const avgGastosAvulsos =
    monthsForAvg.reduce((sum, ym) => sum + Number(totalsByMonth(ym).totalG || 0), 0) / Math.max(1, monthsForAvg.length);

  const recentGastos = state.gastos.slice(-80).map((gasto) => {
    const membro = getMembro(gasto.membroId);
    const cartao = gasto.cartaoId ? getCartao(gasto.cartaoId) : null;
    return {
      desc: gasto.desc,
      valor: Number(gasto.valor),
      categoria: gasto.cat,
      mes: gasto.mes,
      membro: membro.nome,
      forma: gasto.forma,
      cartao: cartao ? cardName(cartao) : "",
    };
  });

  const activeParcelas = state.parcelas.slice(-80).map((parcela) => {
    const membro = getMembro(parcela.membroId);
    const cartao = parcela.cartaoId ? getCartao(parcela.cartaoId) : null;
    return {
      desc: parcela.desc,
      totalVal: Number(parcela.totalVal),
      total: Number(parcela.total),
      atual: Number(parcela.atual),
      inicio: parcela.inicio,
      pago: Boolean(parcela.pago),
      membro: membro.nome,
      cartao: cartao ? cardName(cartao) : parcela.cartao || "",
    };
  });

  const projectedMonths = Array.from({ length: 6 }, (_, idx) => addMonths(currentMonth, idx + 1)).map((ym) => {
    const projectedParcelas = parcelasDoMes(ym).reduce((sum, item) => sum + item.valorParcela, 0);
    const projectedTotal = projectedParcelas + avgGastosAvulsos;
    return {
      mes: ym,
      parcelasPrevistas: Number(projectedParcelas.toFixed(2)),
      avulsosEstimados: Number(avgGastosAvulsos.toFixed(2)),
      totalEstimado: Number(projectedTotal.toFixed(2)),
    };
  });

  const cardUsage = chargesByCard(currentMonth);
  const alertasLimite = state.cartoes
    .map((card) => {
      const limite = Number(card.limiteAtual || 0);
      const usado = Number(cardUsage[card.id] || 0);
      const percentual = limite > 0 ? Math.round((usado / limite) * 100) : 0;
      return {
        cartao: cardName(card),
        usado: Number(usado.toFixed(2)),
        limite: Number(limite.toFixed(2)),
        percentual,
      };
    })
    .filter((item) => item.percentual >= 70)
    .sort((a, b) => b.percentual - a.percentual);

  return {
    dataReferencia: currentMonth,
    categoriasPermitidas: ASSISTANT_CATEGORIES,
    bancosPermitidos: BANKS.map((bank) => ({ id: bank.id, nome: bank.nome })),
    coresMembroPermitidas: COLORS,
    membros: state.membros.map((member) => ({ id: member.id, nome: member.nome })),
    cartoes: state.cartoes.map((card) => ({ id: card.id, nome: cardName(card), banco: findBank(card.bancoId).nome })),
    gastosRecentes: recentGastos,
    parcelas: activeParcelas,
    resumoMesAtual: totalsByMonth(currentMonth),
    projecoes: projectedMonths,
    alertas: {
      limiteCartoes: alertasLimite,
    },
  };
}

function extractJsonObjectFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_e) {
    // Tenta extrair JSON entre cercas markdown.
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_e) {
      // Continua para tentativa por recorte bruto.
    }
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_e) {
      return null;
    }
  }

  return null;
}

function mapAssistantAction(rawAction, payload) {
  const actionText = normText(rawAction || payload?.action || payload?.acao || payload?.type || "");

  if (actionText.includes("gasto")) return "registrar_gasto";
  if (actionText.includes("parcela")) return "registrar_parcela";
  if (actionText.includes("cartao")) return "registrar_cartao";
  if (actionText.includes("membro") || actionText.includes("pessoa")) return "registrar_membro";
  if (actionText.includes("resposta") || actionText.includes("consulta")) return "resposta";

  const draftAction = normText(payload?.draft?.acao || payload?.draft?.action || "");
  if (draftAction.includes("gasto")) return "registrar_gasto";
  if (draftAction.includes("parcela")) return "registrar_parcela";
  if (draftAction.includes("cartao")) return "registrar_cartao";
  if (draftAction.includes("membro") || draftAction.includes("pessoa")) return "registrar_membro";

  return "resposta";
}

function normalizeGeminiDraft(action, rawDraft) {
  const draft = rawDraft && typeof rawDraft === "object" ? rawDraft : {};

  if (action === "registrar_cartao") {
    const bankId = resolveBankIdFromPrompt(draft) || String(draft.bancoId || draft.bankId || "").trim();
    const fechamentoDia = safeDay(draft.fechamentoDia ?? draft.diaFechamento, 7);
    let vencimentoDia = safeDay(draft.vencimentoDia ?? draft.diaVencimento, 15);

    if (fechamentoDia === vencimentoDia) {
      vencimentoDia = fechamentoDia >= 28 ? 1 : fechamentoDia + 1;
    }

    return {
      type: "registrar_cartao",
      prompt: {
        acao: "registrar_cartao",
        bancoId: bankId,
        banco: String(draft.banco || draft.bank || "").trim(),
        apelido: String(draft.apelido || draft.nome || "").trim(),
        limiteAtual: Number(parseMoney(draft.limiteAtual ?? draft.limite ?? draft.limit ?? "")),
        fechamentoDia,
        vencimentoDia,
      },
    };
  }

  if (action === "registrar_membro") {
    const nome = String(draft.nome || draft.membro || draft.pessoa || "").trim();
    const cor = resolveColorFromPrompt(draft.cor || draft.color || draft.colour);

    return {
      type: "registrar_membro",
      prompt: {
        acao: "registrar_membro",
        nome,
        cor: cor || String(draft.cor || draft.color || "").trim(),
      },
    };
  }

  if (action === "registrar_parcela") {
    const card = resolveCartaoFromPrompt(draft);
    const member = resolveMembroFromPrompt(draft);

    return {
      type: "registrar_parcela",
      prompt: {
        acao: "registrar_parcela",
        descricao: String(draft.descricao || draft.desc || "").trim(),
        valorTotal: Number(parseMoney(draft.valorTotal ?? draft.valor ?? "")),
        numeroParcelas: Math.max(1, parseInt(draft.numeroParcelas ?? draft.total, 10) || 1),
        parcelaAtual: Math.max(1, parseInt(draft.parcelaAtual ?? draft.atual, 10) || 1),
        membroId: Number(draft.membroId || member?.id || state.membros[0]?.id || 0),
        membro: String(draft.membro || member?.nome || ""),
        cartaoId: card?.id || (draft.cartaoId ? Number(draft.cartaoId) : null),
        cartao: String(draft.cartao || (card ? cardName(card) : "")),
        inicio: validYM(draft.inicio) || parseMonthHint(String(draft.inicio || ""), state.viewMonth || curYM()),
      },
    };
  }

  const formaPagamento = normalizeFormaFromPrompt(draft.formaPagamento || draft.forma);
  const card = formaPagamento === "Crédito" ? resolveCartaoFromPrompt(draft) : null;
  const member = resolveMembroFromPrompt(draft);

  return {
    type: "registrar_gasto",
    prompt: {
      acao: "registrar_gasto",
      descricao: String(draft.descricao || draft.desc || "").trim(),
      valor: Number(parseMoney(draft.valor)),
      membroId: Number(draft.membroId || member?.id || state.membros[0]?.id || 0),
      membro: String(draft.membro || member?.nome || ""),
      categoria: normalizeCategoriaFromPrompt(draft.categoria || draft.cat),
      mes: validYM(draft.mes) || parseMonthHint(String(draft.mes || ""), state.viewMonth || curYM()),
      formaPagamento,
      cartaoId: formaPagamento === "Crédito" ? card?.id || (draft.cartaoId ? Number(draft.cartaoId) : null) : null,
      cartao: formaPagamento === "Crédito" ? String(draft.cartao || (card ? cardName(card) : "")) : "",
    },
  };
}

async function callGeminiRawText(userText, systemText) {
  if (!ASSISTANT_GEMINI_API_KEY) {
    throw new Error("API Key Gemini nao informada.");
  }

  const modelCandidates = Array.from(
    new Set([assistantState.activeGeminiModel].concat(ASSISTANT_GEMINI_MODELS).filter(Boolean))
  );

  let lastError = "";

  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(ASSISTANT_GEMINI_API_KEY)}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: String(userText || "") }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 1600,
      },
    };

    if (systemText) {
      body.systemInstruction = { parts: [{ text: String(systemText) }] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    let response;
    let payload;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      payload = await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const message = payload?.error?.message || `Gemini retornou erro ${response.status}.`;
      const normalized = normText(message);
      const unavailable =
        response.status === 400 ||
        response.status === 404 ||
        normalized.includes("no longer available") ||
        normalized.includes("not available") ||
        normalized.includes("not found") ||
        normalized.includes("unsupported") ||
        normalized.includes("nao disponivel");

      lastError = `[${model}] ${message}`;

      if (unavailable) {
        continue;
      }

      throw new Error(lastError);
    }

    const text = (payload?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => String(part?.text || ""))
      .join("\n")
      .trim();

    if (!text) {
      lastError = `[${model}] Gemini nao retornou conteudo util.`;
      continue;
    }

    assistantState.activeGeminiModel = model;
    return text;
  }

  throw new Error(lastError || "Nenhum modelo Gemini disponivel para esta chave.");
}

async function runOnlineAssistantPipeline(text) {
  const context = assistantContextSnapshot();

  const systemPrompt = [
    "Voce e um assistente financeiro para um app pessoal de gastos.",
    "Retorne SOMENTE JSON valido, sem markdown e sem texto fora do JSON.",
    "Formato de saida:",
    '{"action":"registrar_gasto|registrar_parcela|registrar_cartao|registrar_membro|resposta","message":"texto curto para o usuario","draft":{}}',
    "Use action de cadastro quando o usuario pedir para criar ou registrar gastos, parcelas, cartoes ou membros.",
    "Use action=resposta para perguntas gerais, analiticas, projecoes e dicas.",
    "Para registrar_gasto, draft deve conter: descricao, valor, membroId, categoria, mes(YYYY-MM), formaPagamento, cartaoId(opcional).",
    "Para registrar_parcela, draft deve conter: descricao, valorTotal, numeroParcelas, parcelaAtual, membroId, cartaoId, inicio(YYYY-MM).",
    "Para registrar_cartao, draft deve conter: bancoId (ou banco), apelido, limiteAtual, fechamentoDia, vencimentoDia.",
    "Para registrar_membro, draft deve conter: nome e cor.",
    "Campos desconhecidos devem vir como null ou string vazia.",
    "Categorias permitidas: Alimentação, Transporte, Saúde, Educação, Lazer, Moradia, Vestuário, Outro.",
    "Quando for resposta analitica, priorize os dados do contexto enviado (resumo, projecoes e alertas) e entregue orientacoes praticas objetivas.",
  ].join("\n");

  const userPrompt = [
    "Contexto da conta em JSON:",
    JSON.stringify(context),
    "",
    "Mensagem do usuario:",
    text,
  ].join("\n");

  const raw = await callGeminiRawText(userPrompt, systemPrompt);
  const payload = extractJsonObjectFromText(raw);

  if (!payload) {
    throw new Error("A IA online nao retornou JSON estruturado.");
  }

  const action = mapAssistantAction(payload.action || payload.acao || payload.type, payload);
  const message = String(payload.message || payload.resposta || "").trim();

  if (["registrar_gasto", "registrar_parcela", "registrar_cartao", "registrar_membro"].includes(action)) {
    const rawDraft = payload.draft && typeof payload.draft === "object" ? payload.draft : payload;
    const normalizedDraft = normalizeGeminiDraft(action, rawDraft);
    setAssistantDraft(normalizedDraft);
    return;
  }

  if (message) {
    assistantPushMessage("assistant", message);
    return;
  }

  assistantPushMessage("assistant", raw);
}

async function submitAssistantMessage() {
  const input = assistantEl("ai-input");
  if (!input || assistantState.isBusy) return;

  const text = input.value.trim();
  if (!text) return;

  assistantPushMessage("user", text);
  input.value = "";

  const intent = detectAssistantIntent(text);

  if (intent === "confirmar") {
    confirmAssistantDraft();
    return;
  }

  if (intent === "editar") {
    toggleAssistantDraftEditor();
    return;
  }

  if (intent === "cancelar") {
    cancelAssistantDraft();
    return;
  }

  try {
    setAssistantBusy(true);
    await runOnlineAssistantPipeline(text);
  } catch (error) {
    const message = error?.message || "Falha ao consultar o Gemini.";
    assistantPushMessage("assistant", `Nao consegui processar com Gemini agora: ${message}`);
  } finally {
    setAssistantBusy(false);
  }
}

function initAssistant() {
  const input = assistantEl("ai-input");
  const log = assistantEl("ai-chat-log");
  if (!input || !log) return;
  setAssistantBusy(false);

  if (!assistantState.messages.length) {
    assistantState.messages.push({
      role: "assistant",
      text: [
        "Assistente IA ativo.",
        `Modo unico Gemini ativo (${assistantState.activeGeminiModel}).`,
        "Descreva um novo gasto, parcela, cartao ou membro e eu monto os campos do formulario para voce revisar antes de salvar.",
        "Tambem posso responder perguntas de contexto, projecoes e dicas financeiras com base nos seus dados.",
      ].join("\n"),
    });
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitAssistantMessage();
    }
  });

  renderAssistantPanel();
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
