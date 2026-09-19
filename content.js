(() => {
  if (window.__devLensInjected) {
    window.__devLensInjected = false;
    location.reload();
    return;
  }

  window.__devLensInjected = true;

  const state = {
    locked: false,
    currentElement: null,
    currentAnalysis: null
  };

  const COLORS = {
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.12)",
    panel: "#0f1117",
    panel2: "#171a23",
    border: "#2a2f3a",
    text: "#f5f7fb",
    muted: "#9ca3af",
    detected: "#22c55e",
    inferred: "#60a5fa",
    unknown: "#f59e0b"
  };

  const style = document.createElement("style");
  style.id = "__devlens_styles";
  style.textContent = `
    #__devlens_highlight {
      position: fixed;
      pointer-events: none;
      z-index: 2147483645;
      display: none;
      border: 2px solid ${COLORS.accent};
      background: ${COLORS.accentSoft};
      box-sizing: border-box;
      transition: left .08s ease, top .08s ease, width .08s ease, height .08s ease;
    }

    #__devlens_tooltip {
      position: fixed;
      z-index: 2147483646;
      display: none;
      pointer-events: none;
      background: ${COLORS.panel};
      color: ${COLORS.text};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 8px 10px;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,.28);
      max-width: 360px;
    }

    #__devlens_panel {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 390px;
      max-height: min(720px, calc(100vh - 40px));
      overflow: hidden;
      z-index: 2147483647;
      color: ${COLORS.text};
      background: ${COLORS.panel};
      border: 1px solid ${COLORS.border};
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,.42);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #__devlens_panel * { box-sizing: border-box; }
    #__devlens_header {
      padding: 13px 14px;
      border-bottom: 1px solid ${COLORS.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${COLORS.panel2};
    }
    #__devlens_title { font-weight: 700; font-size: 14px; }
    #__devlens_subtitle { color: ${COLORS.muted}; font-size: 11px; margin-top: 2px; }
    #__devlens_close {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 7px;
      color: ${COLORS.muted};
      background: transparent;
      cursor: pointer;
      font-size: 18px;
    }
    #__devlens_close:hover { background: #242936; color: white; }

    #__devlens_content {
      overflow-y: auto;
      max-height: calc(min(720px, 100vh - 40px) - 58px);
      padding: 12px;
    }

    .devlens-section {
      margin-bottom: 12px;
      border: 1px solid ${COLORS.border};
      border-radius: 10px;
      overflow: hidden;
      background: #12151c;
    }

    .devlens-section-head {
      padding: 9px 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 7px;
      background: #171a23;
    }

    .devlens-section-body { padding: 10px; }
    .devlens-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 5px 0;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }
    .devlens-row:last-child { border-bottom: 0; }
    .devlens-key { color: ${COLORS.muted}; }
    .devlens-value { color: ${COLORS.text}; text-align: right; word-break: break-word; }

    .devlens-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .devlens-detected { background: rgba(34,197,94,.12); color: ${COLORS.detected}; }
    .devlens-inferred { background: rgba(96,165,250,.12); color: ${COLORS.inferred}; }
    .devlens-unknown { background: rgba(245,158,11,.12); color: ${COLORS.unknown}; }

    .devlens-code {
      margin: 7px 0 0;
      padding: 9px;
      overflow-x: auto;
      background: #0b0d12;
      border: 1px solid ${COLORS.border};
      border-radius: 7px;
      color: #dbe2f0;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .devlens-muted { color: ${COLORS.muted}; }
    .devlens-explanation { color: #e5e7eb; }
    .devlens-button {
      width: 100%;
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 9px 10px;
      margin-top: 8px;
      background: #1a1e28;
      color: ${COLORS.text};
      cursor: pointer;
      text-align: left;
    }
    .devlens-button:hover { background: #222735; }
  `;
  document.documentElement.appendChild(style);

  const highlight = document.createElement("div");
  highlight.id = "__devlens_highlight";
  document.documentElement.appendChild(highlight);

  const tooltip = document.createElement("div");
  tooltip.id = "__devlens_tooltip";
  document.documentElement.appendChild(tooltip);

  const panel = document.createElement("div");
  panel.id = "__devlens_panel";
  panel.innerHTML = `
    <div id="__devlens_header">
      <div>
        <div id="__devlens_title">DevLens</div>
        <div id="__devlens_subtitle">Hover an element · click to lock</div>
      </div>
      <button id="__devlens_close" title="Close inspector">×</button>
    </div>
    <div id="__devlens_content">
      <div class="devlens-muted">Move your cursor over a webpage element.</div>
    </div>
  `;
  document.documentElement.appendChild(panel);

  const content = panel.querySelector("#__devlens_content");
  panel.querySelector("#__devlens_close").addEventListener("click", (event) => {
    event.stopPropagation();
    cleanup();
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeText(value, fallback = "Unknown") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function getElementName(el) {
    if (!el || el.nodeType !== 1) return "element";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classes = typeof el.className === "string"
      ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).map(c => `.${c}`).join("")
      : "";
    return `<${tag}${id}${classes}>`;
  }

  function getTextPreview(el) {
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 100 ? `${text.slice(0, 100)}…` : text;
  }

  function getDomPath(el) {
    const parts = [];
    let node = el;

    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();

      if (node.id) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }

      const classes = typeof node.className === "string"
        ? node.className.split(/\s+/).filter(Boolean).slice(0, 2)
        : [];

      if (classes.length) part += `.${classes.join(".")}`;

      let sibling = node;
      let index = 1;

      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === node.tagName) index++;
      }

      part += `:nth-of-type(${index})`;
      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(" > ");
  }

  function getLayoutInfo(el, styles) {
    const parent = el.parentElement;
    const parentStyles = parent ? getComputedStyle(parent) : null;

    const result = {
      display: styles.display,
      position: styles.position,
      flexDirection: styles.flexDirection,
      justifyContent: styles.justifyContent,
      alignItems: styles.alignItems,
      gridTemplateColumns: styles.gridTemplateColumns,
      parentDisplay: parentStyles?.display || null,
      parentFlexDirection: parentStyles?.flexDirection || null
    };

    let explanation = "The element uses normal document flow.";
    if (styles.position === "fixed") {
      explanation = "The element is fixed to the viewport and stays in place while the page scrolls.";
    } else if (styles.position === "sticky") {
      explanation = "The element uses sticky positioning, so it can remain attached to the viewport after reaching its scroll threshold.";
    } else if (styles.position === "absolute") {
      explanation = "The element is absolutely positioned relative to its containing block.";
    } else if (styles.display === "flex") {
      explanation = "The element itself uses Flexbox to arrange its children.";
    } else if (styles.display === "grid") {
      explanation = "The element itself uses CSS Grid to arrange its children.";
    } else if (parentStyles?.display === "flex") {
      explanation = "The parent uses Flexbox, so this element is being positioned as a flex item.";
    } else if (parentStyles?.display === "grid") {
      explanation = "The parent uses CSS Grid, so this element is being positioned as a grid item.";
    }

    return { result, explanation };
  }

  function collectEvents(el) {
    const events = [];

    // Chrome/DevTools internals are not reliably available to page scripts.
    // Keep this conservative rather than claiming an event was found when it was not.
    for (const attr of Array.from(el.attributes || [])) {
      if (/^on[a-z]+$/i.test(attr.name)) {
        events.push({
          type: attr.name.slice(2).toLowerCase(),
          source: "inline handler"
        });
      }
    }

    return events;
  }

  function collectFrameworkInfo(el) {
    const info = {
      framework: "Not detected",
      component: null,
      confidence: "Unknown"
    };

    try {
      const keys = Object.keys(el);

      const reactKey = keys.find(k =>
        k.startsWith("__reactFiber$") ||
        k.startsWith("__reactInternalInstance$")
      );

      const reactPropsKey = keys.find(k => k.startsWith("__reactProps$"));

      if (reactKey || reactPropsKey) {
        info.framework = "React";
        info.confidence = "Detected";

        const fiber = reactKey ? el[reactKey] : null;
        let current = fiber;
        let depth = 0;

        while (current && depth < 12) {
          const type = current.type;

          if (typeof type === "function") {
            info.component = type.displayName || type.name || null;
            if (info.component) break;
          }

          if (typeof type === "string" && current.elementType && typeof current.elementType === "function") {
            info.component = current.elementType.displayName || current.elementType.name || null;
            if (info.component) break;
          }

          current = current.return;
          depth++;
        }
      }

      const vueKey = keys.find(k =>
        k.startsWith("__vueParentComponent") ||
        k.startsWith("__vue_app__")
      );

      if (vueKey && info.framework === "Not detected") {
        info.framework = "Vue";
        info.confidence = "Detected";
      }
    } catch {
      // Intentionally keep framework information conservative.
    }

    return info;
  }

  function analyzeElement(el) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    const layout = getLayoutInfo(el, styles);
    const events = collectEvents(el);
    const framework = collectFrameworkInfo(el);

    const htmlAttributes = {};
    for (const attr of Array.from(el.attributes || []).slice(0, 20)) {
      htmlAttributes[attr.name] = attr.value;
    }

    const detected = [
      ["Element", getElementName(el)],
      ["Size", `${Math.round(rect.width)} × ${Math.round(rect.height)} px`],
      ["Display", styles.display],
      ["Position", styles.position],
      ["Font", `${styles.fontSize} ${styles.fontFamily.split(",")[0]}`],
      ["Color", styles.color],
      ["Background", styles.backgroundColor],
      ["Padding", styles.padding],
      ["Margin", styles.margin],
      ["Border radius", styles.borderRadius]
    ];

    if (framework.framework !== "Not detected") {
      detected.push(["Framework", framework.framework]);
      if (framework.component) detected.push(["Component", framework.component]);
    }

    if (events.length) {
      detected.push(["Events", events.map(e => e.type).join(", ")]);
    }

    const inferred = [];

    if (layout.explanation) inferred.push(layout.explanation);

    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") {
      inferred.push("This is intended to behave as an interactive control.");
    }

    if (el.tagName === "A" && el.getAttribute("href")) {
      inferred.push("This element is a link and its destination is available from the href attribute.");
    }

    if (styles.transition !== "all 0s ease 0s" && styles.transition !== "none") {
      inferred.push("A CSS transition is present, so some visual changes may animate rather than change instantly.");
    }

    if (styles.cursor === "pointer") {
      inferred.push("The pointer cursor suggests this element is intended to be interactive.");
    }

    const unknown = [
      "The exact business logic behind this element cannot be determined from the DOM and computed CSS alone."
    ];

    if (!events.length && (el.tagName === "BUTTON" || el.tagName === "A")) {
      unknown.push("No inline event handler was detected. Framework or externally registered event listeners may still exist.");
    }

    return {
      element: getElementName(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === "string" ? el.className : null,
      text: getTextPreview(el),
      path: getDomPath(el),
      attributes: htmlAttributes,
      layout,
      detected,
      inferred,
      unknown,
      events,
      framework,
      html: el.outerHTML.length > 2000 ? `${el.outerHTML.slice(0, 2000)}…` : el.outerHTML
    };
  }

  function moveHighlight(el) {
    const rect = el.getBoundingClientRect();

    highlight.style.display = "block";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;

    const tooltipX = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - 380
    );

    const tooltipY = rect.bottom + 8 < window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - 48);

    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
  }

  function showTooltip(el) {
    tooltip.style.display = "block";
    tooltip.innerHTML = `
      <strong>${escapeHtml(getElementName(el))}</strong>
      <span style="color:${COLORS.muted};"> · click to lock</span>
    `;
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function renderAnalysis(analysis) {
    const detectedRows = analysis.detected.map(([key, value]) => `
      <div class="devlens-row">
        <span class="devlens-key">${escapeHtml(key)}</span>
        <span class="devlens-value">${escapeHtml(value)}</span>
      </div>
    `).join("");

    const inferredRows = analysis.inferred.length
      ? analysis.inferred.map(item => `
          <div style="margin-bottom:8px;" class="devlens-explanation">
            ${escapeHtml(item)}
          </div>
        `).join("")
      : `<div class="devlens-muted">No strong inference available.</div>`;

    const unknownRows = analysis.unknown.map(item => `
      <div style="margin-bottom:8px;" class="devlens-explanation">
        ${escapeHtml(item)}
      </div>
    `).join("");

    const attributes = Object.entries(analysis.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");

    content.innerHTML = `
      <div class="devlens-section">
        <div class="devlens-section-head">🧠 ${escapeHtml(analysis.element)}</div>
        <div class="devlens-section-body">
          ${analysis.text ? `<div class="devlens-muted" style="margin-bottom:8px;">“${escapeHtml(analysis.text)}”</div>` : ""}
          <div class="devlens-row">
            <span class="devlens-key">DOM path</span>
            <span class="devlens-value">${escapeHtml(analysis.path)}</span>
          </div>
        </div>
      </div>

      <div class="devlens-section">
        <div class="devlens-section-head">
          <span class="devlens-badge devlens-detected">DETECTED</span>
          What the page tells us
        </div>
        <div class="devlens-section-body">${detectedRows}</div>
      </div>

      <div class="devlens-section">
        <div class="devlens-section-head">
          <span class="devlens-badge devlens-inferred">INFERRED</span>
          What this likely means
        </div>
        <div class="devlens-section-body">${inferredRows}</div>
      </div>

      <div class="devlens-section">
        <div class="devlens-section-head">
          <span class="devlens-badge devlens-unknown">UNKNOWN</span>
          What we cannot safely know
        </div>
        <div class="devlens-section-body">${unknownRows}</div>
      </div>

      <div class="devlens-section">
        <div class="devlens-section-head">HTML</div>
        <div class="devlens-section-body">
          <pre class="devlens-code">${escapeHtml(analysis.html)}</pre>
          ${attributes ? `<div class="devlens-muted" style="margin-top:8px;">Attributes: ${escapeHtml(attributes)}</div>` : ""}
        </div>
      </div>

      <div class="devlens-section">
        <div class="devlens-section-head">📐 Layout explanation</div>
        <div class="devlens-section-body">
          ${escapeHtml(analysis.layout.explanation)}
        </div>
      </div>

      <button class="devlens-button" id="__devlens_ai_button">
        ✨ Explain this element with AI
      </button>
    `;

    const aiButton = content.querySelector("#__devlens_ai_button");
    aiButton?.addEventListener("click", () => {
      requestAIExplanation(analysis);
    });
  }

  async function requestAIExplanation(analysis) {
    const aiButton = content.querySelector("#__devlens_ai_button");
    if (aiButton) {
      aiButton.disabled = true;
      aiButton.textContent = "✨ Generating explanation…";
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "DEVLENS_EXPLAIN",
        payload: {
          element: analysis.element,
          html: analysis.html,
          css: analysis.detected,
          layout: analysis.layout,
          framework: analysis.framework,
          events: analysis.events,
          inferred: analysis.inferred,
          unknown: analysis.unknown
        }
      });

      const section = document.createElement("div");
      section.className = "devlens-section";
      section.innerHTML = `
        <div class="devlens-section-head">✨ AI explanation</div>
        <div class="devlens-section-body">
          <div class="devlens-explanation">${escapeHtml(response?.text || "AI explanation was not available.")}</div>
        </div>
      `;

      content.insertBefore(section, aiButton);
      aiButton.remove();
    } catch (error) {
      if (aiButton) {
        aiButton.disabled = false;
        aiButton.textContent = "✨ Explain this element with AI";
      }

      const section = document.createElement("div");
      section.className = "devlens-section";
      section.innerHTML = `
        <div class="devlens-section-head">AI explanation</div>
        <div class="devlens-section-body">
          <div class="devlens-muted">
            AI explanation could not be generated. The detected and inferred information above is still available.
          </div>
        </div>
      `;

      content.insertBefore(section, aiButton);
    }
  }

  function selectElement(el) {
    if (!el || el === panel || panel.contains(el)) return;

    state.currentElement = el;
    state.currentAnalysis = analyzeElement(el);
    state.locked = true;

    hideTooltip();
    moveHighlight(el);
    renderAnalysis(state.currentAnalysis);
  }

  function cleanup() {
    state.locked = false;
    state.currentElement = null;
    state.currentAnalysis = null;
    window.__devLensInjected = false;

    style.remove();
    highlight.remove();
    tooltip.remove();
    panel.remove();

    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize, true);
  }

  function onMouseMove(event) {
    if (state.locked) return;

    const el = event.target;

    if (
      !el ||
      el === panel ||
      panel.contains(el) ||
      el === highlight ||
      el === tooltip
    ) {
      return;
    }

    if (el.nodeType !== 1) return;

    moveHighlight(el);
    showTooltip(el);
    renderAnalysis(analyzeElement(el));
  }

  function onClick(event) {
    if (
      event.target === panel ||
      panel.contains(event.target) ||
      event.target === highlight ||
      event.target === tooltip
    ) {
      return;
    }

    if (state.locked) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    selectElement(event.target);
  }

  function onScroll() {
    if (state.currentElement && state.locked) {
      moveHighlight(state.currentElement);
    }
  }

  function onResize() {
    if (state.currentElement) {
      moveHighlight(state.currentElement);
    }
  }

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);

  // Initial state.
  renderAnalysis({
    element: "No element selected",
    text: "",
    path: "—",
    detected: [["Status", "Move your cursor over the page"]],
    inferred: ["Hover an element to see what DevLens can detect and what it can infer."],
    unknown: ["DevLens will explicitly mark information it cannot safely determine."],
    attributes: {},
    html: "<hover an element>",
    layout: { explanation: "Waiting for an element." }
  });
})();
