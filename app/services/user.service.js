import { prisma } from '#lib/prisma.js';

/**
 * User Service
 * 
 * Best Practice: Service returns raw Prisma entities
 * Mapping to API response format is done in controller via mapper
 */

/**
 * Common select fields for user queries
 */
const USER_SELECT_FIELDS = {
  user_id: true,
  username: true,
  email: true,
  full_name: true,
  phone_number: true,
  avatar_url: true,
  is_ban: true,
  is_activate: true,
  created_at: true,
  updated_at: true,
  roles: {
    select: {
      role_id: true,
      role_name: true,
    },
  },
};

/**
 * Get user profile by ID
 * Returns raw Prisma entity or null
 */
export const getUserById = async (userId) => {
  return prisma.users.findUnique({
    where: { user_id: BigInt(userId) , is_ban: false},
    select: USER_SELECT_FIELDS,
  });
};

/**
 * Update user profile
 * Returns raw Prisma entity
 */
export const updateUserProfile = async (userId, updateData) => {
  const data = {};
  
  if (updateData.username !== undefined) data.username = updateData.username;
  if (updateData.fullName !== undefined) data.full_name = updateData.fullName;
  if (updateData.phoneNumber !== undefined) data.phone_number = updateData.phoneNumber;
  if (updateData.avatarUrl !== undefined) data.avatar_url = updateData.avatarUrl;
  
  data.updated_at = new Date();

  return prisma.users.update({
    where: { user_id: BigInt(userId) },
    data,
    select: USER_SELECT_FIELDS,
  });
};

/**
 * Get user avatar URL
 * Returns the avatar URL or null
 */
export const getAvatarUrl = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { user_id: BigInt(userId) },
    select: { avatar_url: true },
  });
  return user?.avatar_url || null;
};

/**
 * Update user avatar
 * Returns raw Prisma entity
 */
export const updateUserAvatar = async (userId, avatarUrl) => {
  return prisma.users.update({
    where: { user_id: BigInt(userId) },
    data: {
      avatar_url: avatarUrl,
      updated_at: new Date(),
    },
    select: {
      user_id: true,
      avatar_url: true,
    },
  });
};

/**
 * Change user password
 */
export const changeUserPassword = async (userId, hashedPassword) => {
  await prisma.users.update({
    where: { user_id: BigInt(userId) },
    data: {
      password: hashedPassword,
      updated_at: new Date(),
    },
  });
  
  return true;
};

/**
 * Get user's current password hash for verification
 */
export const getUserPasswordHash = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { user_id: BigInt(userId) },
    select: { password: true },
  });
  
  return user?.password || null;
};

/**
 * Get all users with pagination and filters (Admin)
 * Returns raw Prisma entities + pagination metadata
 */
export const getAllUsers = async (page = 0, size = 10, keyword = '', status = '', sort = '') => {
  const skip = page * size;
  
  // Build where clause
  const where = {
    roles: {
      role_name: { not: 'admin' }, // Exclude admin users
    },
  };
  
  // Add keyword search
  if (keyword) {
    where.OR = [
      { username: { contains: keyword, mode: 'insensitive' } },
      { email: { contains: keyword, mode: 'insensitive' } },
      { full_name: { contains: keyword, mode: 'insensitive' } },
    ];
  }
  
  // Add status filter
  if (status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'banned') {
      where.is_ban = true;
    } else if (statusLower === 'active') {
      where.is_ban = false;
      where.is_activate = true;
    } else if (statusLower === 'inactive') {
      where.is_activate = false;
    }
  }
  
  // Build orderBy
  let orderBy = { created_at: 'desc' }; // Default: newest
  if (sort === 'oldest') {
    orderBy = { created_at: 'asc' };
  } else if (sort === 'name-asc') {
    orderBy = { full_name: 'asc' };
  } else if (sort === 'name-desc') {
    orderBy = { full_name: 'desc' };
  }

  const [users, total] = await Promise.all([
    prisma.users.findMany({
      where,
      orderBy,
      skip,
      take: size,
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        phone_number: true,
        avatar_url: true,
        is_ban: true,
        is_activate: true,
        created_at: true,
        roles: {
          select: {
            role_name: true,
          },
        },
      },
    }),
    prisma.users.count({ where }),
  ]);

  return {
    data: users,
    pagination: {
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
    },
  };
};

/**
 * Ban a user
 */
export const banUser = async (userId) => {
  await prisma.users.update({
    where: { user_id: BigInt(userId) },
    data: {
      is_ban: true,
      updated_at: new Date(),
    },
  });
  return true;
};

/**
 * Unban a user
 */
export const unbanUser = async (userId) => {
  await prisma.users.update({
    where: { user_id: BigInt(userId) },
    data: {
      is_ban: false,
      updated_at: new Date(),
    },
  });
  return true;
};

/**
 * Ban multiple users
 */
export const banUsersBulk = async (userIds) => {
  await prisma.users.updateMany({
    where: {
      user_id: {
        in: userIds.map(id => BigInt(id)),
      },
    },
    data: {
      is_ban: true,
      updated_at: new Date(),
    },
  });
  return true;
};

export const userService = {
  getUserById,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
  getUserPasswordHash,
  getAllUsers,
  banUser,
  unbanUser,
  banUsersBulk,
  getAvatarUrl,
};
