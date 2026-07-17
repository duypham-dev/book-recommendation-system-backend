import fs from "fs/promises";
import path from "path";
import os from "os";
import { ApiResponse, logger } from "#utils/index.js";

const storePath = path.join(os.tmpdir(), "webhook-doc-store.json");

// Helper to load store from json file
const loadStore = async () => {
  try {
    const data = await fs.readFile(storePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading webhook store file: ${error.message}. Initializing default store.`);
    // If not found, return empty template with default contents
    const defaultStore = {
      doc: {
        id: "tekbook-webhook-guide",
        title: "Hướng Dẫn Tích Hợp Webhook Cập Nhật Tự Động Cho Nguồn Website (Web Crawl)",
        category: "Tài liệu Tích hợp Webhook",
        description: "Tài liệu hướng dẫn cấu hình webhook push để đồng bộ nội dung tự động từ CMS của trang web với cơ sở dữ liệu tri thức của chatbot.",
        version: 1,
        lastUpdated: new Date().toISOString(),
        sections: [
          {
            heading: "1. Tổng Quan về Webhook Cập Nhật",
            body: "Một nguồn dữ liệu được thêm vào chatbot bằng cách crawl website có 2 cơ chế cập nhật nội dung:\n- Lịch tự động (polling): Hệ thống tự kiểm tra định kỳ mỗi N giờ, crawl lại bất kể nội dung có đổi hay không.\n- Webhook (push): Hệ thống nguồn (CMS) chủ động gửi tín hiệu ngay khi có nội dung mới, giảm độ trễ cập nhật xuống khoảng 15 giây.\n\nWebhook chỉ áp dụng được khi chúng ta kiểm soát trực tiếp hệ thống CMS của trang nguồn, nhằm cấu hình phía CMS chủ động gửi request."
          },
          {
            heading: "2. Cơ Chế Debounce Tránh Quét Trùng Lặp",
            body: "Khi CMS cập nhật nhiều trang liên tiếp trong một thao tác (ví dụ chỉnh sửa cả một mục tài liệu), nó có thể gửi nhiều request webhook dồn dập trong vài giây. Cơ chế xử lý:\n- Request đầu tiên trong một cửa sổ 15 giây: hệ thống lên lịch crawl lại sau đúng 15 giây.\n- Mọi request tiếp theo trong cùng cửa sổ: bị loại bỏ (debounced), không tạo thêm tác vụ crawl lặp lại không cần thiết."
          },
          {
            heading: "3. Cơ Chế Bảo Mật với X-Webhook-Secret",
            body: "- webhook_token (thành phần trong URL) là khoá định tuyến, không phải bí mật - chỉ cần đủ khó đoán để tránh dò quét.\n- Secret xác thực được truyền riêng qua header 'X-Webhook-Secret', không nằm trong URL và không xuất hiện trong access log.\n- Secret được mã hoá (Fernet) trước khi lưu vào database, không lưu ở dạng plaintext. Giá trị plaintext chỉ hiển thị đúng một lần tại thời điểm tạo.\n- Các trường hợp lỗi xác thực (token không tồn tại, webhook đang tắt, hoặc secret sai) đều trả về chung lỗi 403 Forbidden để ngăn dò quét."
          },
          {
            heading: "4. Cấu Hình Webhook Phía CMS",
            body: "Đưa các thông tin cấu hình webhook sau vào CMS của bạn:\n- Webhook URL: Callback URL được cấp cho nguồn này (ví dụ: http://localhost:5000/api/v1/web-crawls/webhook/<webhook_token>)\n- Method: POST\n- Header: X-Webhook-Secret: <secret_token>\n- Body: Không bắt buộc (hệ thống không đọc nội dung body)."
          }
        ]
      },
      webhookUrl: "",
      webhookSecret: "",
      isAutoTrigger: true
    };
    try {
      await fs.writeFile(storePath, JSON.stringify(defaultStore, null, 2), "utf-8");
    } catch (writeErr) {
      logger.error(`Error initializing default store file: ${writeErr.message}`);
    }
    return defaultStore;
  }
};

// Helper to save store to json file
const saveStore = async (store) => {
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
};

// Helper to trigger webhook POST request from Backend server
const triggerWebhookHelper = async (webhookUrl, webhookSecret, updatedDoc) => {
  const logs = [];
  const addLog = (type, msg) => {
    logs.push({ type, message: msg, timestamp: new Date().toLocaleTimeString() });
  };

  addLog("info", `[Backend Server] Khởi tạo kết nối Webhook tới URL: ${webhookUrl}`);
  
  const payload = {
    event: "document.updated",
    timestamp: new Date().toISOString(),
    document_id: updatedDoc.id,
    version: updatedDoc.version,
    message: "Webhook triggered via TekBook CMS Backend"
  };

  const headers = {
    "Content-Type": "application/json"
  };

  if (webhookSecret) {
    headers["X-Webhook-Secret"] = webhookSecret;
    addLog("info", `[Backend Server] Đính kèm header xác thực: X-Webhook-Secret: ${webhookSecret.slice(0, 4)}...${webhookSecret.slice(-4)}`);
  } else {
    addLog("warning", "[Backend Server] Không có Secret Key cấu hình. Gửi request không xác thực.");
  }

  try {
    addLog("info", `[Backend Server] Đang gửi HTTP POST request từ Backend Server...`);
    const startTime = performance.now();
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const responseText = await response.text();
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      parsedJson = responseText;
    }

    const isSuccess = response.status >= 200 && response.status < 300;
    if (isSuccess) {
      if (parsedJson && parsedJson.debounced) {
        addLog("warning", `[Backend Server] Webhook nhận 202 Accepted (Debounced) trong ${duration}ms! Response: ${JSON.stringify(parsedJson)}`);
      } else {
        addLog("success", `[Backend Server] Webhook gửi thành công từ Backend trong ${duration}ms! HTTP Status: ${response.status} ${response.statusText}`);
      }
    } else {
      if (response.status === 403) {
        addLog("error", `[Backend Server] Lỗi xác thực 403 Forbidden! Hãy kiểm tra token hoặc secret.`);
      } else {
        addLog("error", `[Backend Server] Webhook thất bại! HTTP Status: ${response.status}. Response: ${responseText}`);
      }
    }

    return {
      success: isSuccess,
      logs,
      response: {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        headers: Array.from(response.headers.entries()).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
        body: parsedJson
      }
    };
  } catch (error) {
    addLog("error", `[Backend Server] Lỗi kết nối mạng từ Backend Server: ${error.message}`);
    return {
      success: false,
      logs,
      response: {
        status: "FAILED",
        statusText: "Connection Error",
        duration: "N/A",
        headers: {},
        body: { error: error.message }
      }
    };
  }
};

// GET /webhook-doc
const getWebhookDoc = async (req, res, next) => {
  try {
    const store = await loadStore();
    return ApiResponse.success(res, store, "Webhook documentation details fetched successfully");
  } catch (err) {
    logger.error(`Error in getWebhookDoc: ${err.message}`);
    next(err);
  }
};

// POST /webhook-doc
const updateWebhookDoc = async (req, res, next) => {
  try {
    const { doc, webhookUrl, webhookSecret, isAutoTrigger } = req.body;

    const store = {
      doc,
      webhookUrl: webhookUrl || "",
      webhookSecret: webhookSecret || "",
      isAutoTrigger: isAutoTrigger !== false
    };

    await saveStore(store);
    logger.info(`Webhook store updated locally to v${doc.version}`);

    let triggerResult = null;
    if (store.isAutoTrigger && store.webhookUrl) {
      triggerResult = await triggerWebhookHelper(store.webhookUrl, store.webhookSecret, store.doc);
    }

    return ApiResponse.success(
      res, 
      { store, triggerResult }, 
      "Webhook document updated and webhook triggered successfully"
    );
  } catch (err) {
    logger.error(`Error in updateWebhookDoc: ${err.message}`);
    next(err);
  }
};

// POST /webhook-doc/trigger
const triggerManualWebhook = async (req, res, next) => {
  try {
    const store = await loadStore();
    if (!store.webhookUrl) {
      return ApiResponse.error(res, "Webhook URL is not configured", 400);
    }

    const triggerResult = await triggerWebhookHelper(store.webhookUrl, store.webhookSecret, store.doc);
    return ApiResponse.success(res, triggerResult, "Webhook triggered manually");
  } catch (err) {
    logger.error(`Error in triggerManualWebhook: ${err.message}`);
    next(err);
  }
};

export { getWebhookDoc, updateWebhookDoc, triggerManualWebhook };
