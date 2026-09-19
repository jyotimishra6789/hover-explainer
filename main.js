// Runs in the PAGE's own JavaScript world. The content script can't see properties that
// page code (React, Vue, inline handlers) attaches to elements, so it asks this script.
// Protocol: content script dispatches "hx-probe" on an element; we write JSON to a
// data-hx-info attribute; the content script reads it and removes it immediately.
(() => {
  if (window.__hxMain) return;
  window.__hxMain = true;

  const clip = (s, n = 300) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };
  const fn = (f) => ({ name: f.name || '(anonymous)', src: clip(Function.prototype.toString.call(f)) });

  function react(el) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    if (!key) return null;
    const fiber = el[key];
    const props = fiber.memoizedProps || {};
    const handlers = Object.keys(props)
      .filter((k) => /^on[A-Z]/.test(k) && typeof props[k] === 'function')
      .map((k) => ({ event: k, ...fn(props[k]) }));
    const components = [];
    for (let f = fiber.return; f && components.length < 5; f = f.return) {
      const t = f.type;
      if (t && (typeof t === 'function' || typeof t === 'object')) {
        const n = t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name;
        if (n) components.push(n);
      }
    }
    return { components, handlers };
  }

  function vue(el) {
    const inst = el.__vueParentComponent;
    if (inst) {
      const components = [];
      for (let i = inst; i && components.length < 5; i = i.parent) {
        const n = i.type && (i.type.name || i.type.__name);
        if (n) components.push(n);
      }
      return { version: 3, components };
    }
    if (el.__vue__) return { version: 2, components: [el.__vue__.$options?.name || '(anonymous)'] };
    return null;
  }

  function inline(el) {
    const out = [];
    for (const ev of ['onclick', 'onchange', 'oninput', 'onsubmit', 'onkeydown', 'onmouseover']) {
      if (typeof el[ev] === 'function') out.push({ event: ev, ...fn(el[ev]) });
    }
    return out;
  }

  document.addEventListener('hx-probe', (e) => {
    const el = e.target;
    const out = {};
    try {
      out.react = react(el) || undefined;
      out.vue = vue(el) || undefined;
      out.inline = inline(el);
    } catch (err) {
      out.error = String(err);
    }
    el.setAttribute('data-hx-info', JSON.stringify(out));
  }, true);
})();
