// ===== Elwaset — auto kashida (tatweel ـ) for a nicer elongated Arabic look =====
// Inserts the tatweel character between letters that actually JOIN (correct Arabic
// joining rules), across all visible Arabic text — including content added later.
// Display-only: it never touches inputs, code, numbers, or Latin text, and search
// strips it back out so matching still works.
(function () {
  const TATWEEL = 'ـ';
  // right-joining letters: they connect to the PREVIOUS letter but NOT to the next,
  // so we must never place a tatweel AFTER them.
  const noJoinAfter = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'ٲ', 'ٳ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ى', 'ء', 'ژ', 'ڑ', 'ۀ', 'ە']);
  const isMark = ch => (ch >= 'ً' && ch <= 'ٟ') || ch === 'ٰ' || ch === TATWEEL; // harakat/shadda/etc.
  const isLetter = ch => (ch >= 'ء' && ch <= 'ي') || (ch >= 'ٱ' && ch <= 'ۓ') || ch === 'ە';

  // add tatweel inside a single Arabic run (letters + marks)
  function kashidify(run) {
    const chars = Array.from(run);
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      out += ch;
      if (isMark(ch)) continue;
      // next non-mark letter
      let j = i + 1;
      while (j < chars.length && isMark(chars[j])) j++;
      if (j >= chars.length) break;
      const nxt = chars[j];
      // A joins forward (dual-joining) AND B is a joining letter (not hamza)
      if (isLetter(ch) && !noJoinAfter.has(ch) && isLetter(nxt) && nxt !== 'ء') out += TATWEEL;
    }
    return out;
  }
  const process = t => t.replace(/[ء-ۿـ]+/g, kashidify);

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CODE', 'PRE', 'NOSCRIPT', 'KBD', 'SAMP']);
  function skip(el) {
    return !el || (el.classList && el.classList.contains('no-kashida')) || SKIP_TAGS.has(el.tagName) || el.isContentEditable;
  }
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      const v = node.nodeValue;
      if (v && v.indexOf(TATWEEL) === -1 && /[ء-ۿ]/.test(v)) {
        const nv = process(v);
        if (nv !== v) node.nodeValue = nv;
      }
      return;
    }
    if (node.nodeType !== 1 || skip(node)) return;
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function run() { try { walk(document.body); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  // handle content added/updated later (dashboard-driven catalog, chatbot, etc.)
  try {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes) m.addedNodes.forEach(walk);
        if (m.type === 'characterData') walk(m.target);
      }
    });
    const start = () => mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  } catch (e) {}

  // expose a stripper so search/matching can ignore tatweel
  window.stripKashida = s => String(s == null ? '' : s).replace(/ـ/g, '');
})();
