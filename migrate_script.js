import "dotenv/config";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// 1. CẤU HÌNH MINIO & SUPABASE
// ==========================================
const MINIO_BUCKET = process.env.MINIO_BUCKET;
const minioClient = new S3Client({
  region: process.env.MINIO_REGION || "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const SUPABASE_URL = "https://obqcwqzddbiizqhrcyvh.storage.supabase.co/storage/v1/s3";
const SUPABASE_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY;  
// Đảm bảo trong file .env bạn đặt NEW_SUPABASE_BUCKET=book-files
const SUPABASE_BUCKET = "book-files"; 

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Thiếu cấu hình NEW_SUPABASE_URL hoặc NEW_SUPABASE_SERVICE_KEY trong .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Hàm helper để convert stream từ S3 sang Buffer
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// ==========================================
// 2. LOGIC MIGRATION (GIỮ NGUYÊN ĐƯỜNG DẪN)
// ==========================================
async function runMigration() {
  try {
    console.log(`Bắt đầu lấy file từ MinIO bucket: [${MINIO_BUCKET}]...`);

    const listCommand = new ListObjectsV2Command({ Bucket: MINIO_BUCKET });
    const { Contents } = await minioClient.send(listCommand);

    if (!Contents || Contents.length === 0) {
      console.log("Không tìm thấy file nào trong MinIO bucket.");
      return;
    }

    console.log(`Tìm thấy ${Contents.length} files. Bắt đầu đẩy lên Supabase bucket: [${SUPABASE_BUCKET}]...`);

    let successCount = 0;
    let failCount = 0;

    for (const file of Contents) {
      // GIỮ NGUYÊN ĐƯỜNG DẪN TỪ MINIO
      const exactKey = file.Key; 
      
      console.log(`Đang xử lý: ${exactKey}`);

      try {
        // A. Tải dữ liệu từ MinIO
        const getCommand = new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: exactKey });
        const minioResponse = await minioClient.send(getCommand);
        
        const fileBuffer = await streamToBuffer(minioResponse.Body);
        const contentType = minioResponse.ContentType || "application/octet-stream";

        // B. Upload dữ liệu lên Supabase giữ nguyên exactKey
        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(exactKey, fileBuffer, {
            contentType: contentType,
            upsert: true // Ghi đè nếu file đã tồn tại trên Supabase
          });

        if (error) throw error;

        console.log(`   Thành công!`);
        successCount++;
      } catch (err) {
        console.error(`   Lỗi khi upload ${exactKey}:`, err.message);
        failCount++;
      }
    }

    console.log("\n==========================================");
    console.log(`MIGRATION HOÀN TẤT!`);
    console.log(`Thành công: ${successCount} files`);
    console.log(`Thất bại: ${failCount} files`);
    console.log("==========================================");

  } catch (error) {
    console.error("Lỗi hệ thống:", error);
  }
}

runMigration();