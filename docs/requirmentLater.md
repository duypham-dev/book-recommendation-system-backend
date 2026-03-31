[]Thêm tính năng giới hạn số lần thử đăng nhập thất bại của người dùng

[]Hiện tại chỉ cho đăng nhập dùng email đã đăng kí chưa sử dụng đến username

[]Kiểm tra phân quyền người dùng.

[x]Đăng kí xong thì front end bắt đăng nhập nhưng trong redis đã lưu session. (cần fix)

[x]Tích hợp tính năng active tài khoản qua gmail (xác thực gmail); (sửa code ở authCOntroller, service để lấy hoặc tạo tài khoản với trường is_activate).

[x]Khi cập nhật thông tin người dùng thì thông tin trong accesstoken không đổi, nên giao diện không cập nhật đúng, (fix sau).

[x]Thêm kiểm tra auth khi gọi api.

[x]Phần cập nhật thông tin sách chưa cập nhật được ảnh

[x]Thêm cập nhật ảnh profile

[x]Giao diện sửa sách chưa có dark mode

[x] Việc token có thời gian hết hạn 15 phút có thể dẫn tới nguy cơ bảo mật, nếu ai có được token còn thời hạn có thể đổi được mật khẩu

[] Giới hạn đăng nhập sai đang fix cứng cho username hoặc email

[] BIGUPDATE: Thêm tính năng đăng kí hội viên (tích hợp thanh toán), tích hợp sách phải đăng kí hội viên mới xem được.

[] Fix import các modle từ controller sang route hoặc từ service sang route cho gọn



FRONT END

[] Tiến độ đọc sách ở front end đang track bất kể khi user đọc ngược lại

Nếu muốn tối ưu thêm trong tương lai:

Add Error Boundaries cho genre sections
Add retry logic cho failed API calls
Replace hard-coded IDs với slug-based routing
Add prefetching cho likely-to-be-viewed genres
Add skeleton loaders thay vì spinner
Implement stale-while-revalidate strategy