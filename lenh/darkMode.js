
document.addEventListener('DOMContentLoaded', function() {
  const darkBtn = document.getElementById('darkBtn');
  if (darkBtn) {
    // Kiểm tra trạng thái chế độ từ localStorage
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      document.documentElement.classList.add('dark-mode');
      darkBtn.textContent = '🌞 Chế độ sáng';
    } else {
      // Nếu không có trạng thái lưu, đặt chế độ tối làm mặc định
      document.documentElement.classList.add('dark-mode');
      darkBtn.textContent = '🌞 Chế độ sáng';
      localStorage.setItem('darkMode', 'true');
    }

    // Sự kiện khi nhấn nút chuyển chế độ
    darkBtn.onclick = function() {
      document.documentElement.classList.toggle('dark-mode');
      const isDarkMode = document.documentElement.classList.contains('dark-mode');
      darkBtn.textContent = isDarkMode ? '🌞 Chế độ sáng' : '🌙 Chế độ tối';
      // Lưu trạng thái vào localStorage
      localStorage.setItem('darkMode', isDarkMode);
    };
  } else {
    console.error('Phần tử darkBtn không tồn tại.');
  }
});