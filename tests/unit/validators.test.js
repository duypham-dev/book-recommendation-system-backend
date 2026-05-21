/**
 * tests/unit/validators.test.js
 * Unit tests for all Joi validators.
 */
import { describe, it, expect } from 'vitest';
import {
  loginValidationSchema,
  registerValidationSchema,
  resetPasswordValidationSchema,
} from '../../app/validators/auth.validator.js';
import {
  booksListQuerySchema,
  bookIdParamsSchema,
  sameGenreQuerySchema,
} from '../../app/validators/book.validator.js';
import {
  adminListQuerySchema,
  genreBodySchema,
  bulkIdsBodySchema,
} from '../../app/validators/admin.validator.js';
import {
  ratingBodySchema,
  historyBodySchema,
} from '../../app/validators/interaction.validator.js';
import {
  updateProfileBodySchema,
  changePasswordBodySchema,
} from '../../app/validators/user.validator.js';

const JOI_OPTS = { abortEarly: false, stripUnknown: true, convert: true };
const validate = (schema, val) => schema.validate(val, JOI_OPTS);

// ── Auth validators ────────────────────────────────────────────────────────
describe('loginValidationSchema', () => {
  it('accepts valid email + password', () => {
    const { error } = validate(loginValidationSchema, {
      identifier: 'test@example.com',
      password: 'Password1',
    });
    expect(error).toBeUndefined();
  });

  it('accepts valid username + password', () => {
    const { error } = validate(loginValidationSchema, {
      identifier: 'testuser_01',
      password: 'Password1',
    });
    expect(error).toBeUndefined();
  });

  it('rejects missing identifier', () => {
    const { error } = validate(loginValidationSchema, { password: 'Password1' });
    expect(error).toBeDefined();
  });

  it('rejects password shorter than 8 chars', () => {
    const { error } = validate(loginValidationSchema, {
      identifier: 'test@example.com',
      password: 'abc',
    });
    expect(error).toBeDefined();
  });
});

describe('registerValidationSchema', () => {
  const valid = {
    email: 'new@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
    username: 'newuser01',
    fullName: 'New User',
    phoneNumber: '0912345678',
  };

  it('accepts valid payload', () => {
    const { error } = validate(registerValidationSchema, valid);
    expect(error).toBeUndefined();
  });

  it('rejects when passwords do not match', () => {
    const { error } = validate(registerValidationSchema, {
      ...valid,
      confirmPassword: 'Different1',
    });
    expect(error).toBeDefined();
  });

  it('rejects invalid email format', () => {
    const { error } = validate(registerValidationSchema, {
      ...valid,
      email: 'not-an-email',
    });
    expect(error).toBeDefined();
  });

  it('rejects password without uppercase', () => {
    const { error } = validate(registerValidationSchema, {
      ...valid,
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(error).toBeDefined();
  });

  it('rejects phone number < 10 digits', () => {
    const { error } = validate(registerValidationSchema, {
      ...valid,
      phoneNumber: '091',
    });
    expect(error).toBeDefined();
  });
});

describe('resetPasswordValidationSchema', () => {
  it('accepts valid reset payload', () => {
    const { error } = validate(resetPasswordValidationSchema, {
      token: 'abc123',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(error).toBeUndefined();
  });

  it('rejects when confirmPassword does not match newPassword', () => {
    const { error } = validate(resetPasswordValidationSchema, {
      token: 'abc123',
      newPassword: 'NewPass1',
      confirmPassword: 'Different1',
    });
    expect(error).toBeDefined();
  });
});

// ── Book validators ────────────────────────────────────────────────────────
describe('booksListQuerySchema', () => {
  it('applies default page=0, size=12', () => {
    const { value } = validate(booksListQuerySchema, {});
    expect(value.page).toBe(0);
    expect(value.size).toBe(12);
  });

  it('coerces string page/size to numbers', () => {
    const { value } = validate(booksListQuerySchema, { page: '2', size: '5' });
    expect(value.page).toBe(2);
    expect(value.size).toBe(5);
  });

  it('rejects size > 100', () => {
    const { error } = validate(booksListQuerySchema, { size: '200' });
    expect(error).toBeDefined();
  });
});

describe('bookIdParamsSchema', () => {
  it('accepts a valid bookId', () => {
    const { error } = validate(bookIdParamsSchema, { bookId: '123' });
    expect(error).toBeUndefined();
  });

  it('rejects empty bookId', () => {
    const { error } = validate(bookIdParamsSchema, { bookId: '' });
    expect(error).toBeDefined();
  });

  it('rejects missing bookId', () => {
    const { error } = validate(bookIdParamsSchema, {});
    expect(error).toBeDefined();
  });
});

describe('sameGenreQuerySchema', () => {
  it('defaults limit to 6', () => {
    const { value } = validate(sameGenreQuerySchema, {});
    expect(value.limit).toBe(6);
  });

  it('rejects limit > 20', () => {
    const { error } = validate(sameGenreQuerySchema, { limit: '25' });
    expect(error).toBeDefined();
  });
});

// ── Admin validators ───────────────────────────────────────────────────────
describe('adminListQuerySchema', () => {
  it('applies defaults', () => {
    const { value } = validate(adminListQuerySchema, {});
    expect(value.page).toBe(0);
    expect(value.size).toBe(10);
    expect(value.keyword).toBe('');
    expect(value.sort).toBe('');
  });

  it('accepts valid sort values', () => {
    for (const sort of ['newest', 'oldest', 'title-asc', 'title-desc']) {
      const { error } = validate(adminListQuerySchema, { sort });
      expect(error).toBeUndefined();
    }
  });
});

describe('genreBodySchema', () => {
  it('accepts valid name', () => {
    const { error } = validate(genreBodySchema, { name: 'Science Fiction' });
    expect(error).toBeUndefined();
  });

  it('rejects empty name', () => {
    const { error } = validate(genreBodySchema, { name: '' });
    expect(error).toBeDefined();
  });

  it('rejects name longer than 100 chars', () => {
    const { error } = validate(genreBodySchema, { name: 'a'.repeat(101) });
    expect(error).toBeDefined();
  });
});

describe('bulkIdsBodySchema', () => {
  it('accepts array of ids', () => {
    const { error } = validate(bulkIdsBodySchema, { ids: ['1', '2', '3'] });
    expect(error).toBeUndefined();
  });

  it('rejects empty array', () => {
    const { error } = validate(bulkIdsBodySchema, { ids: [] });
    expect(error).toBeDefined();
  });

  it('rejects missing ids', () => {
    const { error } = validate(bulkIdsBodySchema, {});
    expect(error).toBeDefined();
  });
});

// ── Interaction validators ─────────────────────────────────────────────────
describe('ratingBodySchema', () => {
  it('accepts value 1-5', () => {
    for (const v of [1, 2, 3, 4, 5]) {
      const { error } = validate(ratingBodySchema, { value: v });
      expect(error).toBeUndefined();
    }
  });

  it('rejects value 0 or 6', () => {
    expect(validate(ratingBodySchema, { value: 0 }).error).toBeDefined();
    expect(validate(ratingBodySchema, { value: 6 }).error).toBeDefined();
  });
});

describe('historyBodySchema', () => {
  it('accepts progress 0-100', () => {
    expect(validate(historyBodySchema, { progress: 0 }).error).toBeUndefined();
    expect(validate(historyBodySchema, { progress: 100 }).error).toBeUndefined();
  });

  it('rejects progress > 100 or < 0', () => {
    expect(validate(historyBodySchema, { progress: 101 }).error).toBeDefined();
    expect(validate(historyBodySchema, { progress: -1 }).error).toBeDefined();
  });
});

// ── User validators ────────────────────────────────────────────────────────
describe('updateProfileBodySchema', () => {
  it('accepts partial update', () => {
    const { error } = validate(updateProfileBodySchema, { fullName: 'New Name' });
    expect(error).toBeUndefined();
  });

  it('accepts empty object (all optional)', () => {
    const { error } = validate(updateProfileBodySchema, {});
    expect(error).toBeUndefined();
  });

  it('rejects invalid phone number format', () => {
    const { error } = validate(updateProfileBodySchema, { phoneNumber: 'abc' });
    expect(error).toBeDefined();
  });
});

describe('changePasswordBodySchema', () => {
  it('accepts valid current + new passwords', () => {
    const { error } = validate(changePasswordBodySchema, {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass1',
    });
    expect(error).toBeUndefined();
  });

  it('rejects currentPassword shorter than 8 chars', () => {
    const { error } = validate(changePasswordBodySchema, {
      currentPassword: 'short',
      newPassword: 'NewPass1',
    });
    expect(error).toBeDefined();
  });
});