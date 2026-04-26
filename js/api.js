/* ============================================================
   Property Management App — API Layer (replaces database.js)
   Reads data via synchronous XHR on init (from /api/data/all).
   All writes are fire-and-forget fetch calls to the API.
   ============================================================ */

const DB = {
  _cache: {
    agencies: [], clients: [], properties: [],
    propunits: [], tenants: [], transactions: []
  },

  _token() {
    return sessionStorage.getItem('pma_token') || '';
  },

  _keyField(table) {
    return {
      agencies: 'AgencyCode', clients: 'ClientCode', properties: 'PropertyCode',
      propunits: 'UnitCode',  tenants: 'TenantID',   transactions: 'transactionRef'
    }[table];
  },

  // Load all data from API using synchronous XHR so the rest of the page
  // can continue to use synchronous DB.getAll / DB.findOne calls unchanged.
  init() {
    const token = this._token();
    if (!token) return; // login page — no token yet

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data/all', false); // false = synchronous
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    try { xhr.send(); } catch (e) { console.error('DB.init XHR failed:', e); return; }

    if (xhr.status === 200) {
      this._cache = JSON.parse(xhr.responseText);
    } else if (xhr.status === 401) {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }
  },

  // ── Reads (synchronous, from cache) ──────────────────────
  getAll(table) {
    return [...(this._cache[table] || [])];
  },

  find(table, filters) {
    return this.getAll(table).filter(r =>
      Object.entries(filters).every(([k, v]) => r[k] === v)
    );
  },

  findOne(table, filters) {
    return this.find(table, filters)[0] || null;
  },

  // ── Writes (update cache immediately + async API call) ────
  insert(table, record) {
    if (!this._cache[table]) this._cache[table] = [];
    this._cache[table].push(record);
    this._apiWrite('POST', '/api/data/' + table, record);
    return record;
  },

  update(table, keyField, keyValue, updates) {
    if (!keyValue) return false;
    const data = this._cache[table];
    if (!data) return false;
    const idx = data.findIndex(r => r[keyField] === keyValue);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...updates };
    this._apiWrite('PATCH', '/api/data/' + table + '/' + encodeURIComponent(keyValue), updates);
    return true;
  },

  remove(table, keyField, keyValue) {
    if (!keyValue) return;
    if (this._cache[table]) {
      this._cache[table] = this._cache[table].filter(r => r[keyField] !== keyValue);
    }
    this._apiWrite('DELETE', '/api/data/' + table + '/' + encodeURIComponent(keyValue));
  },

  // DB.save() is used for bulk array replacements (e.g. toggling transaction auth).
  // Detects diffs vs old cache and fires targeted PATCH/DELETE calls.
  save(table, newData) {
    const keyF = this._keyField(table);
    const oldData = [...(this._cache[table] || [])];
    this._cache[table] = [...newData];
    if (!keyF) return;

    const oldMap = new Map(oldData.map(r => [r[keyF], r]));
    const newMap = new Map(newData.map(r => [r[keyF], r]));

    for (const [k] of oldMap) {
      if (!newMap.has(k)) {
        this._apiWrite('DELETE', '/api/data/' + table + '/' + encodeURIComponent(k));
      }
    }
    for (const [k, rec] of newMap) {
      const old = oldMap.get(k);
      if (old) {
        const diff = {};
        for (const [field, val] of Object.entries(rec)) {
          if (JSON.stringify(old[field]) !== JSON.stringify(val)) diff[field] = val;
        }
        if (Object.keys(diff).length > 0) {
          this._apiWrite('PATCH', '/api/data/' + table + '/' + encodeURIComponent(k), diff);
        }
      }
    }
  },

  // ── Helpers ───────────────────────────────────────────────
  nextCode(table, keyField, prefix, pad) {
    pad = pad || 3;
    const existing = this.getAll(table)
      .map(r => r[keyField])
      .filter(c => c && c.startsWith(prefix));
    if (!existing.length) return prefix + '001';
    const nums = existing.map(c => parseInt(c.replace(prefix, ''), 10) || 0);
    return prefix + String(Math.max.apply(null, nums) + 1).padStart(pad, '0');
  },

  nextTxRef() {
    const all = this.getAll('transactions');
    const existing = all.map(t => parseInt((t.transactionRef || '').replace('TXN-', ''), 10) || 0);
    const next = existing.length ? Math.max.apply(null, existing) + 1 : 1;
    return 'TXN-' + String(next).padStart(5, '0');
  },

  reset() {
    const token = this._token();
    fetch('/api/data/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }).then(function() { window.location.reload(); }).catch(console.error);
  },

  _apiWrite(method, url, body) {
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this._token()
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).catch(function(err) { console.error('API write error:', err); });
  }
};
