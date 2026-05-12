/**
 * Admin Recommendation Controller
 * Làm proxy trung gian giữa Frontend và RS (FastAPI).
 * Tất cả các hành động quản lý model đều đi qua đây để:
 * 1. Đảm bảo xác thực & phân quyền (Admin only).
 * 2. Có thể xóa cache Redis ngay khi cần.
 * 3. Tập trung logic gọi RS, không để frontend gọi thẳng.
 */

import { redisClient } from '#config/redis.js';
import { ApiResponse } from '#utils/response.js';
import { logger } from '#utils/logger.js';

// URL của RS FastAPI server
const RS_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:8003';

// Prefix của các Redis key liên quan đến recommendation
const CACHE_PREFIXES = {
  recommendations: 'recommendations:',
  similarBooks: 'similar_books:',
};

// ─────────────────────────────────────────────
// Helper: Gọi RS FastAPI và ném lỗi nếu thất bại
// ─────────────────────────────────────────────
const callRS = async (method, path, { params, body } = {}) => {
  // Xây dựng URL với query params nếu có
  const url = new URL(`${RS_URL}/api/v1${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, v);
    });
  }

  const options = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (!response.ok) {
    const message = data?.detail || `RS returned ${response.status}`;
    const err = new Error(message);
    err.statusCode = response.status;
    throw err;
  }

  return data;
};

// ─────────────────────────────────────────────
// Helper: Lấy Redis client (đã kết nối)
// ─────────────────────────────────────────────
const getRedis = () => redisClient.getClient();

// ─────────────────────────────────────────────
// Đếm số lượng key theo prefix trong Redis
// Dùng scanIterator — cách idiomatic cho node-redis v4+
// ─────────────────────────────────────────────
const countKeysByPrefix = async (redis, prefix) => {
  let count = 0;
  // scanIterator tự quản lý cursor, không cần vòng do-while thủ công
  for await (const _key of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
    count++;
  }
  return count;
};

// ─────────────────────────────────────────────
// Lấy chi tiết (key, type, ttl, preview) theo prefix
// ─────────────────────────────────────────────
const getKeysWithDetails = async (redis, prefix) => {
  const allKeys = [];
  for await (const key of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
    allKeys.push(key);
  }

  // Lấy thông tin chi tiết của từng key song song
  const details = await Promise.all(
    allKeys.map(async (key) => {
      try {
        const [type, ttl] = await Promise.all([
          redis.type(key),
          redis.ttl(key),
        ]);

        // Lấy preview giá trị (tùy theo type)
        let valuePreview = '';
        let valueType = type;
        if (type === 'string') {
          const raw = await redis.get(key);
          try {
            const parsed = JSON.parse(raw);
            valueType = Array.isArray(parsed) ? 'json_array' : 'json_object';
            valuePreview = `[${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} items]`;
          } catch {
            valuePreview = raw?.substring(0, 50) ?? '';
          }
        }

        return { key, type, ttlSeconds: ttl, valueType, valuePreview };
      } catch {
        return { key, type: 'unknown', ttlSeconds: -1, valueType: 'unknown', valuePreview: '' };
      }
    })
  );

  return details;
};

// ═════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════

/**
 * GET /admin/recommendation/health
 * Kiểm tra trạng thái RS (model đã load chưa, đang retrain không).
 */
export const getHealthStatus = async (req, res) => {
  try {
    const data = await callRS('GET', '/health');
    return ApiResponse.success(res, data, 'Health status fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Health check error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 503);
  }
};

// ═════════════════════════════════════════════
// MODEL INFO
// ═════════════════════════════════════════════

/**
 * GET /admin/recommendation/model-info
 * Trả về thông tin chi tiết của model đang chạy:
 * ALS (users, items, factors, ...) và SBERT (books, profiles, embedding dim).
 */
export const getModelInfo = async (req, res) => {
  try {
    const data = await callRS('GET', '/model/info');
    return ApiResponse.success(res, data, 'Model info fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Model info error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

// ═════════════════════════════════════════════
// RETRAIN
// ═════════════════════════════════════════════

/**
 * POST /admin/recommendation/retrain
 * Trigger full retrain cả ALS lẫn SBERT.
 * RS sẽ chạy retrain ở background task.
 * Sau khi retrain xong, RS sẽ callback lại backend để xóa cache.
 */
export const triggerRetrain = async (req, res) => {
  try {
    const data = await callRS('POST', '/retrain');
    logger.info('[Admin RS] Retrain triggered successfully');
    return ApiResponse.success(res, data, 'Retrain triggered successfully');
  } catch (error) {
    logger.error('[Admin RS] Retrain error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

// ═════════════════════════════════════════════
// ONLINE LEARNING
// ═════════════════════════════════════════════

/**
 * GET /admin/recommendation/online-learning/status
 * Trả về trạng thái online learning và buffer hiện tại.
 */
export const getOnlineLearningStatus = async (req, res) => {
  try {
    const data = await callRS('GET', '/online-learning/status');
    return ApiResponse.success(res, data, 'Online learning status fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Online learning status error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

/**
 * POST /admin/recommendation/online-learning/enable
 * Bật online learning với buffer_size tùy chỉnh.
 * Query param: bufferSize (int, 10–1000, default: 100)
 */
export const enableOnlineLearning = async (req, res) => {
  try {
    const bufferSize = parseInt(req.query.bufferSize) || 100;
    const data = await callRS('POST', '/online-learning/enable', {
      params: { buffer_size: bufferSize },
    });
    logger.info(`[Admin RS] Online learning enabled with buffer_size=${bufferSize}`);
    return ApiResponse.success(res, data, 'Online learning enabled');
  } catch (error) {
    logger.error('[Admin RS] Enable online learning error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

/**
 * POST /admin/recommendation/online-learning/disable
 * Tắt online learning.
 */
export const disableOnlineLearning = async (req, res) => {
  try {
    const data = await callRS('POST', '/online-learning/disable');
    logger.info('[Admin RS] Online learning disabled');
    return ApiResponse.success(res, data, 'Online learning disabled');
  } catch (error) {
    logger.error('[Admin RS] Disable online learning error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

/**
 * POST /admin/recommendation/online-learning/update
 * Trigger cập nhật incremental SBERT user profiles từ buffer.
 * Query param: force (boolean) — bỏ qua ngưỡng buffer nếu true.
 */
export const triggerIncrementalUpdate = async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const data = await callRS('POST', '/online-learning/update', {
      params: { force },
    });

    const statusMsg = data.status === 'updated'
      ? `Đã cập nhật ${data.interactions_processed || 0} tương tác`
      : 'Buffer chưa đủ ngưỡng';

    logger.info(`[Admin RS] Incremental update: ${statusMsg}`);
    return ApiResponse.success(res, data, statusMsg);
  } catch (error) {
    logger.error('[Admin RS] Incremental update error:', error.message);
    return ApiResponse.error(res, error.message, error.statusCode || 500);
  }
};

// ═════════════════════════════════════════════
// CACHE MANAGEMENT
// ═════════════════════════════════════════════

/**
 * GET /admin/recommendation/cache/stats
 * Đếm số lượng key Redis theo từng loại cache gợi ý.
 */
export const getCacheStats = async (req, res) => {
  try {
    const redis = getRedis();

    // Đếm song song tất cả loại cache
    const [recommendationsCount, similarBooksCount] = await Promise.all([
      countKeysByPrefix(redis, CACHE_PREFIXES.recommendations),
      countKeysByPrefix(redis, CACHE_PREFIXES.similarBooks),
    ]);

    const stats = {
      recommendationsCount,
      similarBooksCount,
      totalCount: recommendationsCount + similarBooksCount,
    };

    return ApiResponse.success(res, stats, 'Cache stats fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Cache stats error:', error.message);
    return ApiResponse.error(res, 'Không thể lấy cache stats', 500);
  }
};

/**
 * DELETE /admin/recommendation/cache
 * Xóa toàn bộ Redis cache liên quan đến gợi ý sách.
 * Gồm: recommendations, similar_books, diversity_books.
 */
export const clearRecommendationCache = async (req, res) => {
  try {
    const redis = getRedis();
    let totalDeleted = 0;

    // Dùng scanIterator thay vì scan thủ công để tránh lỗi cursor type mismatch
    for (const prefix of Object.values(CACHE_PREFIXES)) {
      const keysToDelete = [];
      for await (const key of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        keysToDelete.push(key);
      }
      if (keysToDelete.length > 0) {
        // Xóa nhiều keys cùng lúc (del nhận spread args hoặc array)
        await redis.del(keysToDelete);
        totalDeleted += keysToDelete.length;
      }
    }

    logger.info(`[Admin RS] Cleared ${totalDeleted} recommendation cache keys`);
    return ApiResponse.success(res, { deletedCount: totalDeleted }, `Đã xóa ${totalDeleted} cache keys`);
  } catch (error) {
    logger.error('[Admin RS] Clear cache error:', error.message);
    return ApiResponse.error(res, 'Không thể xóa cache', 500);
  }
};


// ═════════════════════════════════════════════
// REDIS INSPECTOR
// ═════════════════════════════════════════════

/**
 * GET /admin/redis/caches
 * Lấy chi tiết tất cả các recommendation cache keys,
 * phân nhóm theo loại (recommendations, similarBooks, diversityBooks).
 */
export const getAllRedisCaches = async (req, res) => {
  try {
    const redis = getRedis();

    // Lấy chi tiết song song cho từng loại
    const [recommendations, similarBooks] = await Promise.all([
      getKeysWithDetails(redis, CACHE_PREFIXES.recommendations),
      getKeysWithDetails(redis, CACHE_PREFIXES.similarBooks),
    ]);

    const result = { recommendations, similarBooks };
    return ApiResponse.success(res, result, 'Redis caches fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Get Redis caches error:', error.message);
    return ApiResponse.error(res, 'Không thể lấy Redis cache details', 500);
  }
};

/**
 * GET /admin/redis/value
 * Lấy giá trị thực tế của một Redis key cụ thể.
 * Query param: key (string, bắt buộc)
 */
export const getRedisKeyValue = async (req, res) => {
  try {
    const { key } = req.query;
    console.log("KEY: ", key)
    if (!key) {
      return ApiResponse.error(res, 'key là bắt buộc', 400);
    }

    const redis = getRedis();
    const type = await redis.type(key);

    let value;
    if (type === 'string') {
      const raw = await redis.get(key);
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }
    } else if (type === 'hash') {
      value = await redis.hGetAll(key);
    } else if (type === 'list') {
      value = await redis.lRange(key, 0, -1);
    } else if (type === 'set') {
      value = await redis.sMembers(key);
    } else if (type === 'zset') {
      value = await redis.zRange(key, 0, -1, { REV: false });
    } else {
      return ApiResponse.error(res, `Không hỗ trợ type: ${type}`, 400);
    }

    return ApiResponse.success(res, value, 'Redis key value fetched successfully');
  } catch (error) {
    logger.error('[Admin RS] Get Redis key value error:', error.message);
    return ApiResponse.error(res, 'Không thể lấy giá trị key', 500);
  }
};
