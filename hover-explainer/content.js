// Hover Explainer content script.
// Injected each time the toolbar button is clicked; after the first run it just toggles.
(() => {
  if (window.__hoverExplainer) { window.__hoverExplainer.toggle(); return; }

  let active = false, locked = null, hovered = null, raf = 0, lastTarget = null;

  // ---------- tiny DOM helper (never uses innerHTML: page strings are untrusted) ----------
  const h = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  };

  // ---------- overlay UI in a shadow root so page CSS can't touch it ----------
  const CSS = `
    *{box-sizing:border-box}
    .box{position:fixed;pointer-events:none;background:rgba(47,91,234,.14);outline:2px solid #2f5bea}
    .parent{position:fixed;pointer-events:none;outline:2px dashed #d6336c;outline-offset:-1px}
    .tag{position:fixed;pointer-events:none;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace;background:#1b2333;color:#fff;
      padding:4px 8px;border-radius:4px;max-width:440px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .panel{position:fixed;top:16px;width:370px;max-height:calc(100vh - 32px);overflow:auto;pointer-events:auto;
      background:#fbfbfd;color:#1b2333;border:1px solid #cfd6e4;border-radius:10px;
      box-shadow:0 12px 32px rgba(20,30,60,.22);font:13px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
    .head{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e1e6f0;
      position:sticky;top:0;background:#fbfbfd}
    .name{font:600 12px ui-monospace,Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .x{border:0;background:none;font-size:18px;line-height:1;cursor:pointer;color:#55627d;padding:2px 6px}
    .body{padding:4px 14px 14px}
    .summary{font-size:14px;margin:10px 0 2px}
    h4{font-size:12px;font-weight:600;color:#55627d;margin:14px 0 4px}
    p{margin:3px 0}
    code,pre{font:12px/1.45 ui-monospace,Menlo,Consolas,monospace}
    code{background:#eef1f8;padding:1px 4px;border-radius:3px}
    pre{background:#eef1f8;padding:6px 8px;border-radius:6px;margin:4px 0;white-space:pre-wrap;word-break:break-word;max-height:140px;overflow:auto}
    .rule{margin:6px 0}.rule b{font:600 12px ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
    .rule small{color:#55627d;margin-left:6px}
    .note{color:#55627d;font-size:12px}
    button.ai{margin-top:6px;background:#2f5bea;color:#fff;border:0;border-radius:6px;padding:7px 12px;font:600 13px system-ui;cursor:pointer}
    button.ai:disabled{opacity:.6;cursor:wait}
    button.link{background:none;border:0;color:#2f5bea;text-decoration:underline;cursor:pointer;font:inherit;padding:0}
    .ai-out{white-space:pre-wrap;margin-top:8px}
  `;
  const host = h('div', { id: 'hover-explainer-host' });
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet(); // constructable sheets aren't blocked by page CSP
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch { root.append(h('style', { text: CSS })); }
  const parentBox = h('div', { class: 'parent' });
  const box = h('div', { class: 'box' });
  const tag = h('div', { class: 'tag' });
  const panel = h('aside', { class: 'panel' });
  root.append(parentBox, box, tag, panel);
  [parentBox, box, tag, panel].forEach((n) => (n.style.display = 'none'));

  // ---------- helpers ----------
  const clip = (s, n = 240) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const sides = (cs, p, suffix = '') => ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs[p + s + suffix]));
  const fmtSides = (a) => (a.every((v) => v === a[0]) ? a[0] + 'px' : a.map((v) => v + 'px').join(' '));
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = [...el.classList].slice(0, 3);
    if (c.length) s += '.' + c.join('.');
    return clip(s, 70);
  };
  const posAncestor = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).position !== 'static') return p;
    }
    return document.documentElement;
  };

  const TAGS = {
    div: 'a generic block container', span: 'a generic inline wrapper', a: 'a link', button: 'a button', img: 'an image',
    p: 'a paragraph', ul: 'an unordered list', ol: 'an ordered list', li: 'a list item', nav: 'a navigation area',
    header: 'a header area', footer: 'a footer area', main: 'the main content area', section: 'a section of content',
    article: 'a self-contained article', aside: 'a side area', form: 'a form', input: 'an input field', label: 'a form label',
    select: 'a dropdown', textarea: 'a multi-line text field', table: 'a table', tr: 'a table row', td: 'a table cell',
    th: 'a table header cell', svg: 'a vector graphic', canvas: 'a drawing surface (canvas)', video: 'a video player',
    iframe: 'an embedded page', code: 'inline code', pre: 'preformatted text', h1: 'a top-level heading', h2: 'a heading',
    h3: 'a heading', h4: 'a heading', h5: 'a heading', h6: 'a heading', body: 'the page body', html: 'the root of the document'
  };

  const JUSTIFY = {
    'flex-start': 'packed at the start', start: 'packed at the start', center: 'centered', 'flex-end': 'packed at the end',
    end: 'packed at the end', 'space-between': 'spread out with equal gaps between them',
    'space-around': 'spread out with space around each', 'space-evenly': 'spread out with equal space everywhere'
  };
  const ALIGN = {
    center: 'centered', 'flex-start': 'aligned to the start', start: 'aligned to the start', 'flex-end': 'aligned to the end',
    end: 'aligned to the end', baseline: 'aligned on their text baselines'
  };

  // ---------- ask the page's own JS world about frameworks and handlers ----------
  function probe(el) {
    try {
      el.dispatchEvent(new CustomEvent('hx-probe'));
      const raw = el.getAttribute('data-hx-info');
      el.removeAttribute('data-hx-info');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  // ---------- CSS rules that match the element ----------
  function matchedRules(el) {
    const out = [];
    let blocked = 0;
    const visit = (rules, src) => {
      for (const r of rules) {
        if (r.selectorText !== undefined && r.style) {
          try { if (el.matches(r.selectorText)) out.push({ selector: r.selectorText, css: clip(r.style.cssText), src }); } catch { /* odd selector */ }
        } else if (r.cssRules) {
          if (r.media && !matchMedia(r.media.mediaText).matches) continue;
          visit(r.cssRules, src);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { blocked++; continue; } // cross-origin sheet
      let src = 'inline <style>';
      try { if (sheet.href) src = new URL(sheet.href).pathname.split('/').pop() || sheet.href; } catch { /* ignore */ }
      visit(rules, src);
    }
    return { items: out, blocked };
  }

  // ---------- rule-based explanation ----------
  function layoutLines(el, cs) {
    const L = [];
    const kids = el.children.length;
    const d = cs.display;
    if (d === 'none') L.push('Hidden: display is none, so it takes up no space.');
    else if (d.includes('flex')) {
      const dir = cs.flexDirection.startsWith('column') ? 'a column' : 'a row';
      L.push(`Flex container: its ${kids} child${kids === 1 ? '' : 'ren'} are laid out in ${dir}${cs.flexWrap !== 'nowrap' ? ', wrapping onto new lines when space runs out' : ''}.`);
      if (JUSTIFY[cs.justifyContent]) L.push(`Along the ${dir === 'a row' ? 'row' : 'column'}, children are ${JUSTIFY[cs.justifyContent]}.`);
      if (ALIGN[cs.alignItems]) L.push(`Across that direction, children are ${ALIGN[cs.alignItems]}.`);
      if (px(cs.rowGap) || px(cs.columnGap)) L.push(`Gap between children: ${cs.rowGap === cs.columnGap ? cs.rowGap : cs.rowGap + ' rows, ' + cs.columnGap + ' columns'}.`);
    } else if (d.includes('grid')) {
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
      L.push(`Grid container: children are placed into a grid with ${cols.length} column${cols.length === 1 ? '' : 's'} (${clip(cs.gridTemplateColumns, 80)}).`);
      if (px(cs.rowGap) || px(cs.columnGap)) L.push(`Gap between cells: ${cs.rowGap === cs.columnGap ? cs.rowGap : cs.rowGap + ' rows, ' + cs.columnGap + ' columns'}.`);
    } else if (d === 'block') L.push('Block box: fills the available width and stacks vertically with its siblings.');
    else if (d === 'inline') L.push("Inline box: flows within a line of text like a word. Width and height don't apply to it.");
    else if (d === 'inline-block') L.push('Inline-block: flows like a word in a line, but you can set its width and height.');
    else if (d === 'contents') L.push("display: contents — the box itself disappears and its children behave as if they were in its parent.");
    else L.push(`display: ${d}.`);

    const pos = cs.position;
    if (pos === 'relative') L.push('Position relative: offsets nudge it from its normal spot, and it becomes the reference point for absolutely positioned children.');
    else if (pos === 'absolute') L.push(`Position absolute: removed from normal flow and placed relative to <${label(posAncestor(el))}>. Siblings ignore it, so it can overlap them.`);
    else if (pos === 'fixed') L.push('Position fixed: pinned to the browser window, so it stays put while the page scrolls.');
    else if (pos === 'sticky') L.push(`Position sticky: scrolls normally until it reaches top: ${cs.top}, then sticks there.`);
    if (pos !== 'static' && cs.zIndex !== 'auto') L.push(`z-index ${cs.zIndex}: higher numbers are drawn on top of lower ones.`);
    if (cs.cssFloat && cs.cssFloat !== 'none') L.push(`Floated ${cs.cssFloat}: text and inline content wrap around it.`);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const o = cs.overflowX === cs.overflowY ? cs.overflowX : `${cs.overflowX} / ${cs.overflowY}`;
      L.push(`Overflow ${o}: content that doesn't fit is clipped or scrollable.`);
    }
    if (cs.transform !== 'none') L.push('A CSS transform is applied: it can move, scale or rotate the element without changing layout.');
    if (parseFloat(cs.opacity) < 1) L.push(`Opacity ${cs.opacity}: partly see-through.`);

    const parent = el.parentElement;
    if (parent && cs.position !== 'absolute' && cs.position !== 'fixed') {
      const pcs = getComputedStyle(parent);
      if (pcs.display.includes('flex')) {
        let s = `Flex item of <${label(parent)}>, so that parent decides how it is sized and placed.`;
        if (parseFloat(cs.flexGrow) > 0) s += ` flex-grow ${cs.flexGrow}: it takes a share of leftover space.`;
        if (cs.alignSelf !== 'auto') s += ` align-self ${cs.alignSelf} overrides the parent's alignment.`;
        L.push(s);
      } else if (pcs.display.includes('grid')) L.push(`Grid item of <${label(parent)}>, so that parent's grid decides where it goes.`);
    }
    return L;
  }

  function boxLines(el, cs) {
    const r = el.getBoundingClientRect();
    const L = [`Size: ${px(r.width)} × ${px(r.height)} px (box-sizing: ${cs.boxSizing}).`];
    for (const [name, p, suf] of [['Padding', 'padding', ''], ['Margin', 'margin', ''], ['Border width', 'border', 'Width']]) {
      const a = sides(cs, p, suf);
      if (a.some(Boolean)) L.push(`${name}: ${fmtSides(a)}.`);
    }
    if (px(cs.borderTopLeftRadius)) L.push(`Rounded corners: ${cs.borderTopLeftRadius}.`);
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') L.push(`Background colour: ${cs.backgroundColor}.`);
    if (cs.boxShadow !== 'none') L.push('Has a box shadow.');
    return L;
  }

  function textLines(el, cs) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return [];
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const L = [`Text: ${fam}, ${cs.fontSize}, weight ${cs.fontWeight}, colour ${cs.color}, line height ${cs.lineHeight}.`];
    if (!['start', 'left'].includes(cs.textAlign)) L.push(`Text alignment: ${cs.textAlign}.`);
    return L;
  }

  function behaviorLines(el, info) {
    const L = [];
    const t = el.tagName.toLowerCase();
    if (t === 'a' && el.getAttribute('href')) {
      L.push(`Link to ${clip(el.getAttribute('href'), 90)}${el.target === '_blank' ? ', opens in a new tab' : ''}.`);
    }
    if (t === 'button' || (t === 'input' && ['submit', 'button'].includes(el.type))) {
      L.push(el.closest('form') && el.type !== 'button' ? 'Clicking submits its form (unless a handler stops it).' : 'Clicking runs whatever handler the page attached.');
    }
    if (t === 'form') L.push(`Form sending ${(el.method || 'get').toUpperCase()} to ${clip(el.getAttribute('action') || '(current page)', 80)}.`);
    if (t === 'input') L.push(`Input of type ${el.type}${el.required ? ', required' : ''}${el.placeholder ? `, placeholder "${clip(el.placeholder, 40)}"` : ''}.`);
    if (t === 'img') L.push(el.alt ? `Image with alt text "${clip(el.alt, 60)}".` : 'Image with no alt text (screen readers get nothing).');
    if (el.getAttribute('role')) L.push(`ARIA role: ${el.getAttribute('role')}.`);
    if (el.getAttribute('aria-label')) L.push(`ARIA label: ${clip(el.getAttribute('aria-label'), 60)}.`);
    return L;
  }

  // ---------- panel rendering ----------
  function section(title, lines) {
    if (!lines.length) return null;
    return h('div', {}, h('h4', { text: title }), ...lines.map((l) => h('p', { text: l })));
  }

  function renderPanel(el) {
    const cs = getComputedStyle(el);
    const info = probe(el);
    const rules = matchedRules(el);
    const layout = layoutLines(el, cs);
    const t = el.tagName.toLowerCase();
    const desc = TAGS[t] || `a <${t}> element`;
    const summary = desc[0].toUpperCase() + desc.slice(1) + '. ' + (layout[0] || '');

    const kids = [h('p', { class: 'summary', text: summary })];
    const add = (n) => n && kids.push(n);
    add(section('Layout and position', layout.slice(1)));
    add(section('Size, spacing and look', boxLines(el, cs)));
    add(section('Text', textLines(el, cs)));

    // Behaviour + framework evidence
    const beh = behaviorLines(el, info);
    const runtime = [];
    if (info.react) {
      if (info.react.components.length) runtime.push(h('p', { text: 'React: rendered by ' + info.react.components.join(' ← ') + ' (nearest first).' }));
      for (const hd of info.react.handlers) runtime.push(h('p', { text: `${hd.event} handler (${hd.name}):` }), h('pre', { text: hd.src }));
    }
    if (info.vue) runtime.push(h('p', { text: `Vue ${info.vue.version}: component chain ${info.vue.components.join(' ← ') || '(unnamed)'}.` }));
    for (const hd of info.inline || []) runtime.push(h('p', { text: `Inline ${hd.event} handler:` }), h('pre', { text: hd.src }));
    if (beh.length || runtime.length) {
      kids.push(h('div', {}, h('h4', { text: 'Behavior' }), ...beh.map((l) => h('p', { text: l })), ...runtime));
    }
    if (!info.react && !info.vue && !(info.inline || []).length) {
      kids.push(h('p', { class: 'note', text: 'No framework or inline handler found. The page may still attach behavior with addEventListener, which this version cannot see.' }));
    }

    // Matched CSS rules
    const shown = rules.items.slice(-8);
    const inlineStyle = el.getAttribute('style');
    const ruleNodes = [];
    if (inlineStyle) ruleNodes.push(h('div', { class: 'rule' }, h('b', { text: 'style attribute' }), h('pre', { text: clip(inlineStyle) })));
    for (const r of shown) ruleNodes.push(h('div', { class: 'rule' }, h('b', { text: r.selector }), h('small', { text: r.src }), h('pre', { text: r.css })));
    kids.push(h('div', {}, h('h4', { text: `CSS rules that match (${shown.length} of ${rules.items.length}, later ones usually win)` }), ...ruleNodes));
    if (rules.blocked) kids.push(h('p', { class: 'note', text: `${rules.blocked} stylesheet${rules.blocked === 1 ? '' : 's'} from other sites can't be read by extensions, so some matching rules may be missing.` }));

    // AI explanation
    const out = h('div', { class: 'ai-out' });
    const btn = h('button', { class: 'ai', text: 'Explain with AI' });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      out.textContent = 'Thinking…';
      const payload = {
        page: location.hostname,
        html: clip(el.outerHTML, 1500),
        rule_based_notes: [...layout, ...boxLines(el, cs)],
        matched_css: shown,
        runtime: info
      };
      try {
        const res = await chrome.runtime.sendMessage({ type: 'ai', payload });
        out.textContent = res.ok ? res.text : res.error;
        if (!res.ok && /API key/.test(res.error)) {
          out.append(' ', h('button', { class: 'link', text: 'Open options', onclick: () => chrome.runtime.sendMessage({ type: 'options' }) }));
        }
      } catch (e) { out.textContent = 'Could not reach the extension: ' + e.message; }
      btn.disabled = false;
    });
    kids.push(h('div', {}, h('h4', { text: 'Deeper explanation' }), btn,
      h('p', { class: 'note', text: "Sends this element's HTML, matching CSS and handler code to Anthropic." }), out));

    const close = h('button', { class: 'x', text: '×', 'aria-label': 'Close panel', onclick: unlock });
    panel.replaceChildren(
      h('div', { class: 'head' }, h('span', { class: 'name', text: label(el) }), close),
      h('div', { class: 'body' }, ...kids)
    );
    const r = el.getBoundingClientRect();
    const onRight = r.left + r.width / 2 > innerWidth / 2; // keep the panel off the element
    panel.style.left = onRight ? '16px' : 'auto';
    panel.style.right = onRight ? 'auto' : '16px';
    panel.style.display = 'block';
  }

  // ---------- highlighting ----------
  function place(node, el) {
    const r = el.getBoundingClientRect();
    Object.assign(node.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  function highlight(el, withTag) {
    place(box, el);
    const p = el.parentElement;
    const pd = p ? getComputedStyle(p).display : '';
    if (p && p !== document.body && p !== document.documentElement && /flex|grid/.test(pd)) place(parentBox, p);
    else parentBox.style.display = 'none';
    if (!withTag) { tag.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const kind = /flex|grid/.test(cs.display) ? ' · ' + cs.display : '';
    tag.textContent = `${label(el)} · ${px(r.width)}×${px(r.height)}${kind}  (click to explain)`;
    tag.style.display = 'block';
    tag.style.left = Math.max(4, Math.min(r.left, innerWidth - 300)) + 'px';
    tag.style.top = (r.bottom + 34 > innerHeight ? Math.max(4, r.top - 28) : r.bottom + 6) + 'px';
  }

  function clearHighlights() {
    [parentBox, box, tag].forEach((n) => (n.style.display = 'none'));
  }

  function lock(el) {
    locked = el;
    highlight(el, false);
    renderPanel(el);
  }

  function unlock() {
    locked = null;
    panel.style.display = 'none';
    panel.replaceChildren();
    clearHighlights();
  }

  // ---------- events ----------
  const isOwn = (e) => e.target === host || host.contains(e.target);

  function onOver(e) {
    if (isOwn(e) || locked) return;
    lastTarget = e.target;
    if (raf) return;
    raf = requestAnimationFrame(() => { // at most once per frame
      raf = 0;
      if (lastTarget && lastTarget !== hovered && lastTarget.nodeType === 1) {
        hovered = lastTarget;
        highlight(hovered, true);
      }
    });
  }

  function onClick(e) {
    if (isOwn(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    lock(e.target);
  }

  const swallow = (e) => { if (!isOwn(e)) e.stopPropagation(); };

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (locked) unlock(); else deactivate();
  }

  function refresh() {
    if (locked) {
      if (!locked.isConnected) return unlock();
      highlight(locked, false);
    } else if (hovered) {
      if (!hovered.isConnected) { hovered = null; clearHighlights(); } else highlight(hovered, true);
    }
  }

  function notify() {
    try { chrome.runtime.sendMessage({ type: 'state', on: active }); } catch { /* extension reloaded */ }
  }

  function activate() {
    active = true;
    document.documentElement.appendChild(host);
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('click', onClick, true);
    for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) document.addEventListener(t, swallow, true);
    document.addEventListener('keydown', onKey, true);
    addEventListener('scroll', refresh, true);
    addEventListener('resize', refresh);
    notify();
  }

  function deactivate() {
    active = false;
    unlock();
    hovered = null;
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('click', onClick, true);
    for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) document.removeEventListener(t, swallow, true);
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', refresh, true);
    removeEventListener('resize', refresh);
    host.remove();
    notify();
  }

  const toggle = () => (active ? deactivate() : activate());
  window.__hoverExplainer = { toggle };
  activate();
})();
