/* Offline localization. Bind display text, never replay the scene on language changes. */
(() => {
  const locales = window.catLocales;
  const sourceKeys = Object.fromEntries(Object.entries(locales.zh).map(([key, source]) => [source, key]));
  const normalize = value => {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    return Object.hasOwn(locales, code) ? code : null;
  };
  let saved;
  try { saved = localStorage.getItem('xiaole.language'); } catch { /* file or private mode may deny storage */ }
  let language = normalize(new URLSearchParams(location.search).get('lang')) || normalize(saved)
    || (navigator.languages || [navigator.language]).map(normalize).find(Boolean) || 'zh';
  function t(key, params = {}) {
    const value = locales[language][key] ?? locales.zh[key] ?? key;
    return value.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
  }
  function text(source, params) {
    if (source == null) return '';
    return t(sourceKeys[source] || source, params);
  }
  function write(element, source, params = {}) {
    element.dataset.i18nSource = source ?? '';
    element.dataset.i18nParams = JSON.stringify(params);
    element.textContent = text(source, params);
  }
  function attribute(element, name, source, params = {}) {
    const bindings = JSON.parse(element.dataset.i18nAttributes || '{}');
    bindings[name] = { source, params };
    element.dataset.i18nAttributes = JSON.stringify(bindings);
    element.setAttribute(name, text(source, params));
  }
  function hydrate(root) {
    const elements = [root, ...root.querySelectorAll('*')];
    for (const element of elements) {
      if (['SCRIPT', 'STYLE', 'OPTION'].includes(element.tagName)) continue;
      if (!element.childElementCount && sourceKeys[element.textContent.trim()]) write(element, element.textContent.trim());
      for (const name of ['aria-label', 'alt', 'title', 'content']) {
        const source = element.getAttribute(name);
        if (source && sourceKeys[source]) attribute(element, name, source);
      }
    }
  }
  function refresh() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    document.title = t('app.documentTitle');
    document.querySelectorAll('[data-i18n-source]').forEach(element => {
      element.textContent = text(element.dataset.i18nSource, JSON.parse(element.dataset.i18nParams || '{}'));
    });
    document.querySelectorAll('[data-i18n-attributes]').forEach(element => {
      for (const [name, binding] of Object.entries(JSON.parse(element.dataset.i18nAttributes))) {
        element.setAttribute(name, text(binding.source, binding.params));
      }
    });
    document.getElementById('languageSelect').value = language;
  }
  function setLanguage(value) {
    const next = normalize(value);
    if (!next) return;
    language = next;
    try { localStorage.setItem('xiaole.language', language); } catch { /* choice still applies for this page */ }
    try {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(history.state, '', url);
    } catch { /* file URL restrictions must not prevent switching */ }
    refresh();
    window.dispatchEvent(new CustomEvent('catlanguagechange', { detail: { language } }));
  }
  const title = document.querySelector('.hud .title');
  const row = document.createElement('div'); row.className = 'brand-row';
  title.before(row); row.append(title);
  const label = document.createElement('label'); label.className = 'language-control';
  label.innerHTML = '<span class="sr-only">选择语言</span><select id="languageSelect"><option value="zh" lang="zh-CN">中文</option><option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option></select>';
  row.append(label);
  document.getElementById('languageSelect').addEventListener('change', event => setLanguage(event.target.value));
  window.catI18n = Object.freeze({ t, text, write, attribute, hydrate, setLanguage, get language() { return language; } });
  hydrate(document.documentElement);
  refresh();
})();
