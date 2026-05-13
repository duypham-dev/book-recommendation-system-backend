import Joi from 'joi';
import { PASSWORD_PATTERN } from '#validators/pattern.js';

// ─── Shared primitives ────────────────────────────────────────────────────────

const pageQuery   = (def = 0)        => Joi.number().integer().min(0).default(def);
const sizeQuery   = (def = 10, max = 100) => Joi.number().integer().min(1).max(max).default(def);
const keywordQuery = () => Joi.string().trim().max(200).default('');
const sortQuery   = (...allowed)     => Joi.string().valid(...allowed).default('');
const requiredId  = (label)          => Joi.string().trim().required()
  .messages({ 'any.required': `${label} là bắt buộc`, 'string.empty': `${label} là bắt buộc` });

// ─── User ID params ───────────────────────────────────────────────────────────

export const userIdParamsSchema = Joi.object({
  userId: requiredId('ID người dùng'),
});

// ─── Profile update body ──────────────────────────────────────────────────────

export const updateProfileBodySchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).optional()
    .messages({
      'string.min': 'Username phải ít nhất 3 ký tự',
      'string.max': 'Username không được vượt quá 50 ký tự',
    }),
  fullName: Joi.string().trim().min(1).max(100).optional()
    .messages({ 'string.max': 'Họ tên không được vượt quá 100 ký tự' }),
  phoneNumber: Joi.string().trim()
    .pattern(/^[0-9+\-\s]{7,15}$/)
    .optional()
    .allow('', null)
    .messages({ 'string.pattern.base': 'Số điện thoại không hợp lệ' }),
  avatarUrl: Joi.string().uri().optional().allow('', null),
});

// ─── Change password body ─────────────────────────────────────────────────────

export const changePasswordBodySchema = Joi.object({
  currentPassword: Joi.string().min(8).max(128).required()
    .messages({ 
      'string.empty': 'Mật khẩu hiện tại là bắt buộc',
      'string.min': 'Mật khẩu hiện tại phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu hiện tại không được quá 128 ký tự',
      'any.required': 'Mật khẩu hiện tại là bắt buộc' }),
  newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(PASSWORD_PATTERN)
      .required()
      .messages({
        'string.empty': 'Mật khẩu mới là bắt buộc',
        'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
        'string.max': 'Mật khẩu mới không được quá 128 ký tự',
        'string.pattern.base': 'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
        'any.required': 'Mật khẩu mới là bắt buộc'
      }),
});

// ─── Paginated query (generic) ────────────────────────────────────────────────

export const paginatedQuerySchema = Joi.object({
  page:    pageQuery(0),
  size:    sizeQuery(10, 100),
  keyword: keywordQuery(),
  sort:    sortQuery('', 'newest', 'title-asc', 'title-desc'),
  status:  Joi.string().optional().allow(''),
});
