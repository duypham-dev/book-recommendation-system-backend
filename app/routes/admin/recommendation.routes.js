/**
 * Admin Recommendation Routes
 * Tất cả route đều yêu cầu xác thực JWT và quyền ADMIN.
 * Đây là lớp proxy giữa Frontend và RS (FastAPI).
 */

import express from 'express';
import { authenticateToken } from '#middlewares/authenticateToken.js';
import { authorizeRole } from '#middlewares/authorize.middleware.js';
import { ROLES } from '#constants/roles.js';
import {
  getHealthStatus,
  getModelInfo,
  triggerRetrain,
  getOnlineLearningStatus,
  enableOnlineLearning,
  disableOnlineLearning,
  triggerIncrementalUpdate,
  getCacheStats,
  clearRecommendationCache,
  getAllRedisCaches,
  getRedisKeyValue,
} from '#controllers/admin/recommendation.controller.js';

const router = express.Router();

// Middleware: authenticate token + authorize role ADMIN
const adminGuard = [authenticateToken, authorizeRole(ROLES.ADMIN)];

// ─────────────────────────────────────────────
// HEALTH & MODEL INFO
// ─────────────────────────────────────────────

/** Check status of Recommendation System */
router.get('/admin/recommendation/health', adminGuard, getHealthStatus);

/** Model's detailed information */
router.get('/admin/recommendation/model-info', adminGuard, getModelInfo);

// ─────────────────────────────────────────────
// RETRAIN
// ─────────────────────────────────────────────

/** Trigger full retrain cả ALS + SBERT */
router.post('/admin/recommendation/retrain', adminGuard, triggerRetrain);

// ─────────────────────────────────────────────
// ONLINE LEARNING
// ─────────────────────────────────────────────

/** Get status of online learning and buffer */
router.get('/admin/recommendation/online-learning/status', adminGuard, getOnlineLearningStatus);

/** Enable online learning (query: ?bufferSize=100) */
router.post('/admin/recommendation/online-learning/enable', adminGuard, enableOnlineLearning);

/** Disable online learning */
router.post('/admin/recommendation/online-learning/disable', adminGuard, disableOnlineLearning);

/** Trigger SBERT profiles update from buffer (query: ?force=true/false) */
router.post('/admin/recommendation/online-learning/update', adminGuard, triggerIncrementalUpdate);

// ─────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────

/** Get statistics of keys by type */
router.get('/admin/recommendation/cache/stats', adminGuard, getCacheStats);

/** Clear all recommendation cache (recommendations, similar) */
router.delete('/admin/recommendation/cache', adminGuard, clearRecommendationCache);

// ─────────────────────────────────────────────
// REDIS INSPECTOR
// ─────────────────────────────────────────────

/** Get detailed information of all recommendation cache keys */
router.get('/admin/redis/caches', adminGuard, getAllRedisCaches);

/** Get the actual value of a Redis key (query: ?key=...) */
router.get('/admin/redis/value', adminGuard, getRedisKeyValue);

export { router as adminRecommendationRouter };
