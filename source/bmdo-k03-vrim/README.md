# V-RIM Studio 2.0 — phần mở rộng Buổi 04

Studio mở tab «V-RIM Studio (mở rộng)» trên `/learn/course/bmdo-k03/lesson/04`, rồi trang `/learn/course/bmdo-k03/lesson/04/vrim`. Tệp `index.html` là bản giao nguyên văn (55 440 byte, sha256 `11f55c1eaffe37de33f4f5217ca1a231b360f92f7190ce18a55ce50d276ccd9a`). Workbook Buổi 04 cũ giữ khóa `bmdo-k03-buoi04-vrim-v1`. Hồ sơ studio chỉ nằm ở `localStorage` khóa `mybizcar-vrim-studio-v2`.

## Mở và sử dụng

Mở `index.html` trong trình duyệt hiện đại. Đây là bản một tệp, không cần cài đặt, không dùng mạng hay dịch vụ AI. Hoặc phục vụ thư mục nguồn bằng máy chủ web tĩnh và mở index.html.

1. Bối cảnh: khai doanh nghiệp, dòng sản phẩm/dịch vụ, ngành, mô hình, Address và UC.
2. Mô thức thực chiến: 24 tình huống giả lập cho 12 nhóm ngành; lọc, tìm, mở điều kiện và thêm mẫu vào thiết kế. Mẫu chỉ thêm ba giả thuyết; không thay thế dữ liệu cũ.
3. Thiết kế: thêm V, B, F riêng; nối F với nhiều B, B với nhiều V. Điền đối tượng, điều kiện, hiện trạng/giả thuyết, nguồn và kế hoạch kiểm chứng. Core/Open quản trị ở mỗi F; MTUA và giới hạn lời hứa ở cấp hồ sơ.
4. Mâm xe minh họa cấu trúc, giữ kích thước cố định. Bấm một điểm để nổi bật điểm và liên kết trực tiếp. Tối đa 18 điểm được hiển thị trên mâm; toàn bộ vẫn ở danh sách.
5. Lăng kính: ba nhóm phản biện và quy tắc chỉ ra thiếu dữ kiện. Không có điểm chất lượng tự động hay chứng nhận thị trường.
6. Cải tiến: lưu mốc trước khi sửa; ghi việc cần thay đổi và bằng chứng cần thu.
7. Đúc kết và cam kết: người chịu trách nhiệm, thời hạn, quyết định. Xuất JSON để sao lưu và nhập lại. In hồ sơ qua cửa sổ báo cáo, có thể chọn lưu PDF từ trình duyệt.

## Giới hạn và quyền riêng tư

- Chỉ lưu ở trình duyệt hiện tại, không đồng bộ thiết bị, không có tài khoản/phân quyền hoặc lưu trữ máy chủ. Không nhập dữ liệu khách hàng nhạy cảm trên máy dùng chung.
- Với file://, hành vi lưu cục bộ có thể khác giữa trình duyệt. Xuất JSON sau mỗi buổi học; không coi bộ nhớ trình duyệt là bản sao lưu dài hạn. Đổi đường dẫn tệp hoặc xóa dữ liệu trình duyệt có thể làm hồ sơ cũ không hiển thị.
- Hồ sơ nhập phiên bản 2 tối đa 3 MB, 500 thành phần; kiểm tra cấu trúc và liên kết trước khi thay thế. Tệp cũ của Buổi 04 có cấu trúc khác, chưa hỗ trợ chuyển đổi tự động.
- “Có bằng chứng” là khai báo của người dùng. Hệ thống chỉ kiểm tra có mô tả nguồn/ngày, không xác minh nguồn hay suy luận nhân quả. Không có AI đang đọc phản hồi.
- 12 nhóm ngành là thư viện mở đầu, không phải tuyên bố bao trùm mọi ngành. Các ngành y tế, tài chính và lĩnh vực có điều kiện cần rà soát chuyên môn riêng.
- Không nối dữ liệu thật với V-CASING/V-TREAD/V-AIR hoặc M-RIM trong bản này. Cần duyệt học thuyết, giao diện dữ liệu và kiểm thử trước khi tích hợp.

## Nguồn và quyết định thiết kế

- Đọc bản gốc `/Users/mac/Desktop/BMDO-K3/BUỔI 04/BMDO-Buoi04-Interactive/index.html`, giữ nguyên không sửa.
- Kế thừa phân biệt V/B/F, hai chiều thiết kế/truy nguyên, Core/Open Rim, MTUA và tinh thần APPLIER.
- Điều chỉnh theo trao đổi của Nguyễn Chí Thành: ví dụ đa ngành, cá nhân hóa, các liên kết nhiều–nhiều, hình mâm xe và phân biệt thiết kế với hiện trạng.
- Gộp E/R trong điều hướng cho gọn; vẫn giữ bài học và cam kết riêng.
- Không kế thừa điểm tổng MDS 24 như kết luận tự động; thay bằng kiểm tra minh bạch các trường và liên kết còn thiếu.
- Hình mâm và vị trí V/B/F là phương án giao diện đề xuất, chưa phải quy ước hình học chính thức của tác giả.

## Bàn giao kỹ thuật

`data.js`: thư viện mẫu và gợi mở. `logic.js`: mô hình/kiểm tra/import. `app.js`: tương tác và lưu/xuất. `style.css`: desktop/mobile. `test.cjs`: kiểm tra model và trình duyệt; đường dẫn runtime cần chỉnh khi chạy ở máy khác. `build.cjs`: đóng gói bản HTML một tệp.

Hồ sơ version 2 gồm context, nodes (V/B/F), lens, improve, snapshots. Liên kết chỉ F→B và B→V; chiều ngược được truy vấn từ cùng dữ liệu. Mỗi node có ID riêng. Xóa node phải xóa liên kết đến nó; các node khác giữ nguyên. Không dùng tên để hợp nhất vì có thể giống tên nhưng khác UC/bối cảnh.
