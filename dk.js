/* DeutschKampus - hafif Supabase istemcisi (dış kütüphane yok) */
(function () {
  var C = window.DK_CFG, SKEY = 'dk_session';
  function load() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(SKEY); } catch (e) {} }
  function norm(d) { return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)), user: d.user }; }
  async function raw(path, opts, token) {
    opts = opts || {};
    var h = Object.assign({ apikey: C.key, 'Content-Type': 'application/json' }, opts.headers || {});
    h.Authorization = 'Bearer ' + (token || C.key);
    var r = await fetch(C.url + path, Object.assign({}, opts, { headers: h }));
    var t = await r.text(), j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status); var err = new Error(m); err.status = r.status; throw err; }
    return j;
  }
  async function session() {
    var s = load(); if (!s) return null;
    if (s.expires_at - 60 < Math.floor(Date.now() / 1000)) {
      try { s = norm(await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) })); save(s); }
      catch (e) { clear(); return null; }
    }
    return s;
  }
  async function authed(path, opts) {
    var s = await session(); if (!s) { location.href = 'login.html'; throw new Error('Oturum yok'); }
    return raw(path, opts, s.access_token);
  }
  window.DK = {
    uid: async function () { var s = await session(); if (!s) return null; try { return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) { return null; } },
    session: session,
    signIn: async function (email, password) { var s = norm(await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })); save(s); return s; },
    signOut: async function () { var s = load(); try { if (s) await raw('/auth/v1/logout', { method: 'POST' }, s.access_token); } catch (e) {} clear(); },
    recover: function (email) { return raw('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email: email }) }); },
    setPassword: function (pw) { return authed('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: pw }) }); },
    fromHash: function () {
      var h = location.hash.replace(/^#/, ''); if (!h) return null;
      var p = new URLSearchParams(h); if (!p.get('access_token')) return null;
      var s = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: parseInt(p.get('expires_at') || '0') || (Math.floor(Date.now() / 1000) + parseInt(p.get('expires_in') || '3600')), user: null };
      save(s); history.replaceState(null, '', location.pathname); return p.get('type') || 'signin';
    },
    get: function (table, q) { return authed('/rest/v1/' + table + (q ? '?' + q : '')); },
    insert: function (table, row) { return authed('/rest/v1/' + table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }); },
    patch: function (table, q, row) { return authed('/rest/v1/' + table + '?' + q, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }); },
    del: function (table, q) { return authed('/rest/v1/' + table + '?' + q, { method: 'DELETE' }); },
    upload: async function (path, file) {
      var s = await session(); if (!s) throw new Error('Oturum yok');
      var r = await fetch(C.url + '/storage/v1/object/documents/' + path, { method: 'POST', headers: { apikey: C.key, Authorization: 'Bearer ' + s.access_token, 'x-upsert': 'true', 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!r.ok) { var t = await r.text(); throw new Error('Yükleme başarısız: ' + t); } return true;
    },
    signedUrl: async function (path) { var j = await authed('/storage/v1/object/sign/documents/' + path, { method: 'POST', body: JSON.stringify({ expiresIn: 120 }) }); return C.url + '/storage/v1' + j.signedURL; },
    removeFile: function (path) { return authed('/storage/v1/object/documents/' + path, { method: 'DELETE' }); }
  };
  window.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.L = {
    step: { pending: 'Bekliyor', active: 'Devam ediyor', done: 'Tamamlandı' },
    app: { planned: 'Planlandı', preparing: 'Hazırlanıyor', submitted: 'Gönderildi', admitted: 'Kabul alındı', rejected: 'Reddedildi', waitlist: 'Bekleme listesi' },
    doc: { missing: 'Eksik', uploaded: 'Yüklendi, kontrol bekliyor', approved: 'Onaylandı', rejected: 'Yeniden yükleyin' },
    pay: { open: 'Açık', paid: 'Ödendi' }
  };
})();
