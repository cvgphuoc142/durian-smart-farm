"""Published knowledge for a fresh install: articles, the CN / EU checklists and contacts.

Every link below was opened and answered 200 when this was written. The contacts are public
institutions with a website only (no personal phone numbers), so nothing here dials a stranger.
Text is general guidance that points to the label and the local plant-protection officer; it
carries no doses.
"""

from typing import Any

PPD_PROCESS = (
    "https://ppd.gov.vn/FileUpload/Documents/P.%20Ke%20hoach/TBKT/"
    "21.12.25_%20Quy%20tr%C3%ACnh%20QLSB%20sau%20rieng-revised%203.pdf"
)
SITTO = (
    "https://nongnghiepmoitruong.vn/"
    "sitto-viet-nam-khuyen-cao-benh-nguy-hiem-tren-sau-rieng-mua-mua-d388059.html"
)
SGGP_GACC = (
    "https://www.sggp.org.vn/"
    "trung-quoc-cap-nhat-829-ma-so-vung-trong-va-131-ma-so-co-so-dong-goi-sau-rieng-viet-nam-post796262.html"
)
CONGTHUONG_GACC = (
    "https://tapchicongthuong.vn/"
    "them-47-ma-so-vung-trong-sau-rieng-du-tieu-chuan-xuat-khau-sang-trung-quoc-105530.htm"
)
SOFRI_HOSPITAL = "https://nongnghiepmoitruong.vn/ra-mat-benh-vien-cay-an-qua-d252910.html"
WIKI_DURIAN = "https://vi.wikipedia.org/wiki/S%E1%BA%A7u_ri%C3%AAng"
PPD = "https://www.ppd.gov.vn/"
KHUYEN_NONG = "https://khuyennongvn.gov.vn"
EU_MRL = "https://food.ec.europa.eu/plants/pesticides/maximum-residue-levels_en"
EU_MRL_LAW = "https://eur-lex.europa.eu/eli/reg/2005/396/oj"
IPPC = "https://www.ippc.int"
GLOBALGAP = "https://www.globalgap.org"
EFSA = "https://www.efsa.europa.eu/en"

_LABEL = (
    "Luôn đọc kỹ nhãn thuốc, chỉ dùng thuốc nằm trong danh mục được phép cho sầu riêng, giữ đúng "
    "thời gian cách ly và ghi lại vào nhật ký. Khi chưa chắc chắn, hãy hỏi cán bộ bảo vệ thực vật "
    "ở địa phương."
)


def _a(
    key: str,
    title: str,
    body: str,
    links: list[str],
    *,
    category: str,
    disease_code: str | None = None,
    plant_parts: list[str] | None = None,
    stages: list[str] | None = None,
    keywords: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "title": title,
        "body": body,
        "source_links": links,
        "category": category,
        "disease_code": disease_code,
        "plant_parts": plant_parts or [],
        "stages": stages or [],
        "search_keywords": keywords or [],
    }


ARTICLES: list[dict[str, Any]] = [
    _a(
        "xi-mu",
        "Nứt thân, xì mủ trên sầu riêng",
        "Bệnh xì mủ trên thân do nấm Phytophthora palmivora gây ra, là một trong những bệnh nguy "
        "hiểm nhất trên sầu riêng. Dấu hiệu: vết nứt hoặc vết úng nước trên thân và cành lớn, "
        "chảy nhựa màu nâu đỏ, vỏ bên trong thối nâu.\n\n"
        "Nấm lây qua nước tưới, nước mưa, đất bám trên giày dép và dụng cụ. Vườn đọng nước, đất "
        "nén chặt và gốc bị trầy xước là điều kiện thuận lợi cho bệnh.\n\n"
        "Cần làm: kê thoát nước cho vườn, tránh vun đất cao sát gốc, dùng dao sạch cạo bỏ phần vỏ "
        "bệnh rồi sát trùng vết cắt, tránh để dụng cụ mang bệnh sang cây khác. Bón phân hữu cơ ủ "
        "hoai với chế phẩm sinh học chứa Trichoderma giúp hạn chế nguồn bệnh trong đất. " + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="stem__stem_cracking_gummosis",
        plant_parts=["stem"],
        keywords=["xì mủ", "nứt thân", "Phytophthora", "chảy mủ"],
    ),
    _a(
        "than-thu-la",
        "Bệnh thán thư trên lá sầu riêng",
        "Thán thư do nấm Colletotrichum gây ra, hay xuất hiện trên lá non vào mùa mưa ẩm. Dấu "
        "hiệu: đốm nâu hoặc xám, viền sẫm, lan rộng làm lá khô cháy và rụng.\n\n"
        "Cần làm: tỉa cành tạo độ thông thoáng, thu gom lá bệnh rụng dưới gốc để tiêu hủy, không "
        "tưới đẫm lên tán vào chiều tối. Theo dõi kỹ ở giai đoạn ra lá non và sau mưa kéo dài. "
        + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="leaf__anthracnose_disease",
        plant_parts=["leaf"],
        keywords=["thán thư", "đốm lá", "Colletotrichum"],
    ),
    _a(
        "vang-la",
        "Lá sầu riêng bị vàng: nguyên nhân thường gặp",
        "Lá vàng có thể do nhiều nguyên nhân: úng rễ hoặc rễ bị tổn thương, thiếu dinh dưỡng "
        "(đạm, kali, magiê, vi lượng), đất chua hoặc nhiễm nấm vùng rễ. Vàng đều từ lá già lên "
        "thường liên quan thiếu dinh dưỡng; vàng kèm héo, rụng lá và rễ thối gợi ý bệnh vùng "
        "rễ.\n\n"
        "Cần làm: kiểm tra thoát nước và độ ẩm gốc, xem rễ tơ còn trắng hay đã nâu thối, bón cân "
        "đối và bổ sung phân hữu cơ hoai mục. Nên phân tích đất hoặc lá khi tình trạng kéo dài. "
        + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="leaf__yellow_leaf",
        plant_parts=["leaf"],
        keywords=["vàng lá", "úng rễ", "thiếu dinh dưỡng"],
    ),
    _a(
        "rep-sap",
        "Rệp sáp hại sầu riêng",
        "Rệp sáp là côn trùng nhỏ phủ lớp sáp trắng như bông, bám trên lá, cành, cuống và trái, "
        "hút nhựa làm cây yếu, đồng thời thải mật ngọt khiến nấm muội đen phát triển. Kiến thường "
        "đi cùng vì được rệp tiết mật.\n\n"
        "Cần làm: kiểm tra định kỳ cuống trái và chồi non, hạn chế kiến di chuyển lên cây, tỉa bỏ "
        "cành tán sát nhau, bảo vệ thiên địch. Phun khi mật số tăng, chú ý phun đều mặt dưới lá và "
        "chùm trái. " + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="leaf__mealybug_infestation",
        plant_parts=["leaf", "stem", "fruit"],
        keywords=["rệp sáp", "kiến", "côn trùng"],
    ),
    _a(
        "bo-tri",
        "Bọ trĩ hại sầu riêng",
        "Bọ trĩ rất nhỏ, chích hút trên lá non, hoa và trái non. Lá bị hại cong queo, mép khô, "
        "trái non sần sùi hoặc biến dạng. Bọ trĩ phát triển mạnh khi thời tiết nắng nóng, khô.\n\n"
        "Cần làm: kiểm tra đọt non và cụm hoa thường xuyên, giữ ẩm vườn vừa phải, tránh bón dư "
        "đạm làm ra lá non liên tục. Phun theo khuyến cáo khi thấy mật số tăng, luân phiên hoạt "
        "chất để tránh kháng thuốc. " + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="leaf__thrips_disease",
        plant_parts=["leaf", "fruit"],
        stages=["flowering_fruit_set", "fruit_growth"],
        keywords=["bọ trĩ", "lá cong", "trái non"],
    ),
    _a(
        "muoi-den",
        "Bệnh muội đen trên lá, thân và trái",
        "Muội đen là lớp nấm màu đen phủ trên bề mặt, mọc trên mật ngọt do rệp sáp, rầy hoặc côn "
        "trùng chích hút tiết ra. Lớp muội cản quang hợp và làm xấu mã trái.\n\n"
        "Cần làm: trị gốc là côn trùng tiết mật chứ không chỉ rửa lớp muội; tỉa cành cho vườn "
        "thoáng, vệ sinh vườn. Khi côn trùng được kiểm soát, lớp muội sẽ bong dần. " + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="leaf__sooty_mold",
        plant_parts=["leaf", "stem", "fruit"],
        keywords=["muội đen", "nấm muội"],
    ),
    _a(
        "thoi-trai",
        "Thối trái sầu riêng",
        "Trái thối thường do nấm (trong đó có Phytophthora) xâm nhập khi trái non gặp mưa ẩm kéo "
        "dài hoặc trái chạm đất, bị trầy xước. Dấu hiệu: vết thâm nâu trên vỏ, lan rộng, trái rụng "
        "sớm hoặc thối sau thu hoạch.\n\n"
        "Cần làm: thoát nước tốt, tỉa tán để trái khô nhanh sau mưa, nhặt và tiêu hủy trái bệnh, "
        "không để trái chạm đất, khử trùng dụng cụ cắt trái. " + _LABEL,
        [PPD_PROCESS, SITTO],
        category="disease",
        disease_code="fruit__fruit_rot",
        plant_parts=["fruit"],
        stages=["fruit_growth", "harvest"],
        keywords=["thối trái", "rụng trái"],
    ),
    _a(
        "benh-hong",
        "Bệnh hồng trên cành và lá",
        "Bệnh hồng do nấm tạo lớp phấn màu hồng nhạt trên cành, thân; cành bệnh héo, lá vàng rồi "
        "khô giữ lại trên cây. Bệnh hay gặp ở vườn rậm rạp, ẩm kéo dài.\n\n"
        "Cần làm: cắt bỏ cành bệnh dưới vết bệnh một đoạn, tiêu hủy ngoài vườn, sát trùng vết cắt "
        "và dụng cụ; tỉa thông thoáng tán. " + _LABEL,
        [PPD_PROCESS],
        category="disease",
        disease_code="leaf__pink_disease",
        plant_parts=["leaf", "stem"],
        keywords=["bệnh hồng", "héo cành"],
    ),
    _a(
        "phuc-hoi",
        "Chăm sóc sau thu hoạch (giai đoạn phục hồi)",
        "Sau thu hoạch cây cần được phục hồi để chuẩn bị cho vụ sau. Các việc chính: tỉa cành "
        "khô, cành sâu bệnh và cành tăm; vệ sinh vườn; bón phân hữu cơ hoai mục kết hợp phân cân "
        "đối để cây ra đợt lá mới khỏe; kiểm tra thoát nước và rễ.\n\n"
        "Ghi lại các lần bón, tưới và chi phí vào nhật ký của vụ để so sánh với vụ sau.",
        [PPD_PROCESS, WIKI_DURIAN],
        category="care",
        stages=["recovery"],
        keywords=["sau thu hoạch", "tỉa cành", "bón phân"],
    ),
    _a(
        "xu-ly-ra-hoa",
        "Chuẩn bị và xử lý ra hoa",
        "Cây cần có bộ lá ổn định (đã qua một hai đợt lá thành thục) trước khi xử lý ra hoa. "
        "Giảm tưới trong thời gian ngắn để cây phân hóa mầm hoa, theo dõi thời tiết và độ ẩm đất, "
        "tránh để cây bị khô kéo dài.\n\n"
        "Chỉ dùng chất điều hòa sinh trưởng đúng nhãn và theo hướng dẫn của cán bộ kỹ thuật. "
        "Ghi lại ngày xử lý để dự kiến ngày thu hoạch của vụ.",
        [PPD_PROCESS, WIKI_DURIAN],
        category="care",
        stages=["flower_induction"],
        keywords=["xử lý ra hoa", "xiết nước", "phân hóa mầm hoa"],
    ),
    _a(
        "ra-hoa-dau-trai",
        "Giai đoạn ra hoa và đậu trái",
        "Hoa sầu riêng nở vào buổi chiều tối và thụ phấn nhờ côn trùng, dơi hoặc thụ phấn bổ "
        "sung bằng tay. Giai đoạn này nhạy cảm với mưa lớn và thiếu nước: tránh tưới lên hoa lúc "
        "đang nở, giữ độ ẩm gốc đều.\n\n"
        "Theo dõi bọ trĩ, rệp và nấm trên cụm hoa. Sau khi đậu trái, tỉa bớt trái dị dạng, trái "
        "mọc dày để trái còn lại phát triển đều.",
        [PPD_PROCESS, WIKI_DURIAN],
        category="care",
        stages=["flowering_fruit_set"],
        keywords=["ra hoa", "đậu trái", "thụ phấn", "tỉa trái"],
    ),
    _a(
        "nuoi-trai",
        "Chăm sóc giai đoạn nuôi trái",
        "Trong giai đoạn nuôi trái, cây cần nước đều và dinh dưỡng cân đối, nhất là kali và "
        "canxi. Tưới đủ, tránh lúc khô lúc úng vì dễ gây nứt trái, rụng trái. Chống đỡ cành mang "
        "nhiều trái, kiểm tra thối trái và sâu bệnh trên trái.\n\n"
        "Khi phun thuốc, tính trước ngày thu hoạch dự kiến để bảo đảm thời gian cách ly.",
        [PPD_PROCESS, WIKI_DURIAN],
        category="care",
        stages=["fruit_growth"],
        keywords=["nuôi trái", "kali", "rụng trái", "nứt trái"],
    ),
    _a(
        "thu-hoach",
        "Thu hoạch đúng độ chín và bảo quản",
        "Thu hoạch khi trái đạt độ chín phù hợp với thị trường (tính từ ngày đậu trái, kết hợp "
        "quan sát gai, cuống và âm thanh khi gõ). Cắt trái bằng dụng cụ sạch, không để trái chạm "
        "đất, để nơi râm mát và vận chuyển nhẹ tay.\n\n"
        "Với hàng xuất khẩu, trái phải đến từ vùng trồng và cơ sở đóng gói có mã số, đồng thời "
        "đủ hồ sơ truy xuất. Ghi lại ngày thu hoạch, sản lượng và người mua vào nhật ký.",
        [PPD_PROCESS, SGGP_GACC],
        category="care",
        stages=["harvest"],
        keywords=["thu hoạch", "độ chín", "bảo quản"],
    ),
    _a(
        "an-toan-thuoc",
        "Dùng thuốc bảo vệ thực vật an toàn và ghi nhật ký",
        "Dùng thuốc đúng lúc, đúng liều, đúng cách theo nhãn; luân phiên hoạt chất; mặc đồ bảo hộ "
        "và không phun khi trời nắng gắt hoặc gió lớn. Tuân thủ thời gian cách ly trước thu "
        "hoạch.\n\n"
        "Ghi nhật ký mỗi lần phun (ngày, tên thuốc, hoạt chất, liều, lô vườn). Hồ sơ này là cơ sở "
        "để truy xuất và để vườn đáp ứng yêu cầu dư lượng của thị trường nhập khẩu.",
        [PPD, KHUYEN_NONG],
        category="care",
        keywords=["thuốc bảo vệ thực vật", "thời gian cách ly", "nhật ký"],
    ),
]

# Standard checklists per market. Item text is a plain-language summary of the requirement,
# each with the page it came from.
STANDARDS: dict[str, dict[str, Any]] = {
    "CN": {
        "title": "Tiêu chuẩn xuất khẩu sầu riêng tươi sang Trung Quốc",
        "description": "Các điều kiện chính để sầu riêng tươi vào thị trường Trung Quốc.",
        "source_links": [SGGP_GACC, CONGTHUONG_GACC],
        "effective_on": "2025-01-01",
        "items": [
            (
                "cn.growing_code",
                "Vùng trồng có mã số",
                "Vườn xuất khẩu phải đăng ký và được phía Trung Quốc (GACC) cấp mã số vùng trồng.",
                SGGP_GACC,
            ),
            (
                "cn.packing_code",
                "Cơ sở đóng gói có mã số",
                "Trái chỉ được đóng gói ở cơ sở đã có mã số được phía Trung Quốc chấp thuận.",
                SGGP_GACC,
            ),
            (
                "cn.contaminants",
                "Kiểm soát cadimi và chất vàng O",
                "Lô hàng cần kết quả kiểm nghiệm cadimi và chất vàng O từ đơn vị được công nhận.",
                SGGP_GACC,
            ),
            (
                "cn.spray_log",
                "Nhật ký sử dụng thuốc và phân bón",
                "Ghi đầy đủ ngày phun, tên thuốc, liều và thời gian cách ly cho từng lô vườn.",
                CONGTHUONG_GACC,
            ),
            (
                "cn.traceability",
                "Truy xuất nguồn gốc",
                "Mỗi lô hàng truy được về vùng trồng và cơ sở đóng gói đã đăng ký.",
                CONGTHUONG_GACC,
            ),
        ],
    },
    "EU": {
        "title": "Tiêu chuẩn xuất khẩu sầu riêng tươi sang EU",
        "description": "Các điều kiện chính về dư lượng, kiểm dịch và truy xuất khi vào EU.",
        "source_links": [EU_MRL, EU_MRL_LAW],
        "effective_on": "2025-01-01",
        "items": [
            (
                "eu.mrl",
                "Dư lượng thuốc dưới mức tối đa (MRL)",
                "Dư lượng hoạt chất trên trái không được vượt mức MRL của EU cho từng hoạt chất.",
                EU_MRL,
            ),
            (
                "eu.mrl_regulation",
                "Dùng thuốc theo quy định của EU",
                "Quy định (EC) 396/2005 đặt mức dư lượng tối đa; chỉ dùng hoạt chất EU cho phép.",
                EU_MRL_LAW,
            ),
            (
                "eu.phyto",
                "Giấy chứng nhận kiểm dịch thực vật",
                "Lô hàng cần giấy chứng nhận kiểm dịch thực vật theo hướng dẫn của IPPC.",
                IPPC,
            ),
            (
                "eu.good_practice",
                "Thực hành nông nghiệp tốt",
                "Áp dụng GlobalG.A.P. hoặc tiêu chuẩn tương đương và lưu hồ sơ đầy đủ.",
                GLOBALGAP,
            ),
            (
                "eu.food_safety",
                "Theo dõi cảnh báo an toàn thực phẩm",
                "Cập nhật yêu cầu và đánh giá rủi ro từ EFSA khi thị trường thay đổi.",
                EFSA,
            ),
        ],
    },
}

CONTACTS: list[dict[str, Any]] = [
    {
        "key": "sofri",
        "kind": "expert",
        "name": "Viện Cây ăn quả miền Nam (SOFRI)",
        "province": "Tiền Giang",
        "locality": "Châu Thành",
        "contact_url": "https://sofri.org.vn",
        "source_link": SOFRI_HOSPITAL,
        "specialty": "Cây ăn quả, bệnh hại sầu riêng",
        "description": "Viện nghiên cứu cây ăn quả Nam Bộ, có Bệnh viện cây ăn quả chẩn đoán bệnh.",
    },
    {
        "key": "ppd",
        "kind": "expert",
        "name": "Cục Trồng trọt và Bảo vệ thực vật",
        "province": "Hà Nội",
        "contact_url": PPD,
        "source_link": PPD,
        "specialty": "Bảo vệ thực vật, mã số vùng trồng, kiểm dịch",
        "description": "Cơ quan quản lý nhà nước về bảo vệ thực vật và mã số vùng trồng xuất khẩu.",
    },
    {
        "key": "khuyen-nong",
        "kind": "expert",
        "name": "Trung tâm Khuyến nông Quốc gia",
        "province": "Hà Nội",
        "contact_url": KHUYEN_NONG,
        "source_link": KHUYEN_NONG,
        "specialty": "Khuyến nông, kỹ thuật canh tác",
        "description": "Tài liệu kỹ thuật và mô hình khuyến nông cho nhiều loại cây trồng.",
    },
    {
        "key": "ctu",
        "kind": "expert",
        "name": "Trường Đại học Cần Thơ",
        "province": "Cần Thơ",
        "contact_url": "https://www.ctu.edu.vn",
        "source_link": "https://www.ctu.edu.vn",
        "specialty": "Nghiên cứu nông nghiệp ĐBSCL",
        "description": "Nghiên cứu bệnh cây và canh tác cây ăn trái vùng Đồng bằng sông Cửu Long.",
    },
    {
        "key": "vaas",
        "kind": "expert",
        "name": "Viện Khoa học Nông nghiệp Việt Nam (VAAS)",
        "province": "Hà Nội",
        "contact_url": "https://vaas.vn",
        "source_link": "https://vaas.vn",
        "specialty": "Khoa học nông nghiệp",
        "description": "Viện đầu ngành về khoa học nông nghiệp, SOFRI là đơn vị trực thuộc.",
    },
    {
        "key": "binh-dien",
        "kind": "store",
        "name": "Công ty Phân bón Bình Điền",
        "province": "Hồ Chí Minh",
        "contact_url": "https://www.binhdien.com",
        "source_link": "https://www.binhdien.com",
        "description": "Nhà sản xuất và phân phối phân bón, thuốc bảo vệ thực vật.",
    },
]
