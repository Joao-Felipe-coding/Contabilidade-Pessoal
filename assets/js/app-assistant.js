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

