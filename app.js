'use strict';

/* ─── UTILS ──────────────────────────────────────── */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso);
  // Short format: Jan '24
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
           .replace(' ', " '");
}

function fullDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ─── STATE ──────────────────────────────────────── */

const state = {
  all:      [],
  filtered: [],
  category: 'all',
  query:    '',
};

/* ─── DATA ───────────────────────────────────────── */

async function loadData() {
  const [pr, po] = await Promise.all([
    fetch('data/prose.json'),
    fetch('data/poems.json'),
  ]);
  if (!pr.ok) throw new Error(`prose.json ${pr.status}`);
  if (!po.ok) throw new Error(`poems.json ${po.status}`);

  const [proseRaw, poemsRaw] = await Promise.all([pr.json(), po.json()]);

  // Guard: handle accidental double-wrapping [[{...}]] => [{...}]
  const prose = Array.isArray(proseRaw[0]) ? proseRaw.flat(1) : proseRaw;
  const poems = Array.isArray(poemsRaw[0]) ? poemsRaw.flat(1) : poemsRaw;

  const all = [
    ...prose.map(e => ({ ...e, type: 'prose' })),
    ...poems.map(e => ({ ...e, type: 'poem'  })),
  ];

  all.sort((a, b) => {
    if (a.pinned   !== b.pinned)   return Number(b.pinned)   - Number(a.pinned);
    if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    return new Date(b.date) - new Date(a.date);
  });

  return all;
}

/* ─── FILTER ─────────────────────────────────────── */

function applyFilters() {
  const q = state.query;
  state.filtered = state.all.filter(e => {
    if (state.category !== 'all' && e.type !== state.category) return false;
    if (q) {
      const searchable = e.content || e.excerpt;
      const hit =
        e.title.toLowerCase().includes(q) ||
        searchable.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
  renderList();
}

/* ─── RENDER LIST ────────────────────────────────── */

/*
  Asymmetric indent logic:
  - Poems get a larger left indent (manuscript margin)
  - Prose entries sit flush or with a small indent
  - Pinned entries break indent rules slightly — they feel "pushed forward"
  This creates visual rhythm without a card grid.
*/
function indentFor(entry, index) {
  if (entry.pinned)        return '0ch';
  if (entry.type === 'poem') return '3ch';
  // Alternate prose between 0 and 1ch for slight unevenness
  return index % 3 === 0 ? '1ch' : '0ch';
}

function renderList() {
  const list    = $('#archiveList');
  const counter = $('#resultCount');

  if (!state.filtered.length) {
    list.innerHTML = '<li class="empty-state">nothing found.</li>';
    counter.textContent = '';
    return;
  }

  const n = state.filtered.length;
  counter.textContent = `${n} ${n === 1 ? 'piece' : 'pieces'}`;

  list.innerHTML = state.filtered.map((e, i) => {
    // Short excerpt for peek — first 90 chars, no newlines
    const peekText = e.excerpt
      .replace(/\n/g, ' ')
      .slice(0, 90)
      .trimEnd() + (e.excerpt.length > 90 ? '…' : '');

    const classes = [
      'entry-row',
      e.pinned  ? 'is-pinned'  : '',
      e.unsent  ? 'is-unsent'  : '',
    ].filter(Boolean).join(' ');

    return `
      <li
        class="${classes}"
        data-id="${esc(e.id)}"
        data-type="${e.type}"
        style="--row-indent: ${indentFor(e, i)}"
        tabindex="0"
        role="listitem"
        aria-label="${esc(e.title)}"
      >
        <span class="entry-date">${formatDate(e.date)}</span>
        <span class="entry-title">${esc(e.title)}</span>
        <span class="entry-type">${e.type}</span>
        <span class="entry-peek">${esc(peekText)}</span>
      </li>
    `;
  }).join('');

  $$('.entry-row', list).forEach(row => {
    const open = () => {
      const entry = state.all.find(e => e.id === row.dataset.id);
      if (entry) openModal(entry);
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
    });
  });
}

/* ─── MODAL ──────────────────────────────────────── */

function openModal(entry) {
  const backdrop = $('#modalBackdrop');
  const body     = $('#modalBody');
  const isPoem   = entry.type === 'poem';

  const metaParts = [
    `<span class="m-date">${fullDate(entry.date)}</span>`,
    `<span class="m-type-meta">${entry.type}</span>`,
    entry.pinned   ? `<span>★ pinned</span>`        : '',
    entry.featured ? `<span>◈ featured</span>`      : '',
    entry.unsent   ? `<span class="m-unsent">○ unsent</span>` : '',
  ].filter(Boolean).join('');

  const tagsHtml = entry.tags.length
    ? `<div class="m-tags">
         <span>tags —</span>
         <span class="m-tags-inner">
           ${entry.tags.map(t => `<span class="m-tag">${esc(t)}</span>`).join('')}
         </span>
       </div>`
    : '';

  body.innerHTML = `
    <span class="m-type">${entry.type}</span>
    <h2 class="m-title${isPoem ? ' is-poem' : ''}" id="modalTitle">${esc(entry.title)}</h2>
    <div class="m-meta">${metaParts}</div>
    <div class="m-content${isPoem ? ' is-poem' : ''}">${esc(entry.content || entry.excerpt)}</div>
    ${tagsHtml}
  `;

  backdrop.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  $('#modalClose').focus();
}

function closeModal() {
  const backdrop = $('#modalBackdrop');
  backdrop.classList.remove('is-open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ─── EVENTS ─────────────────────────────────────── */

function wireEvents() {
  // Filter tabs
  $$('.ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.ftab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.category = btn.dataset.category;
      applyFilters();
    });
  });

  // Search
  const inp   = $('#searchInput');
  const clear = $('#searchClear');

  inp.addEventListener('input', () => {
    state.query  = inp.value.trim().toLowerCase();
    clear.hidden = !state.query;
    applyFilters();
  });

  clear.addEventListener('click', () => {
    inp.value    = '';
    state.query  = '';
    clear.hidden = true;
    inp.focus();
    applyFilters();
  });

  // Modal
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#modalBackdrop').classList.contains('is-open')) closeModal();
  });
}

/* ─── INIT ───────────────────────────────────────── */

async function init() {
  const yr = $('#footerYear');
  if (yr) yr.textContent = new Date().getFullYear();

  wireEvents();

  try {
    state.all      = await loadData();
    state.filtered = [...state.all];
    renderList();
  } catch (err) {
    console.error('[UnSent]', err);
    $('#archiveList').innerHTML = `<li class="empty-state">could not load archive. ${esc(err.message)}</li>`;
  }
}

document.addEventListener('DOMContentLoaded', init);