import { prisma } from '#lib/prisma.js';
import crypto from 'crypto';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default role for new users */
const DEFAULT_ROLE = 'USER';

/** Fields to select for user queries (without password) */
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

/** Fields to select for authentication (includes password) */
const AUTH_SELECT_FIELDS = {
  ...USER_SELECT_FIELDS,
  password: true,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform database user object to API response format
 * Converts BigInt to string and renames snake_case to camelCase
 * @param {Object} dbUser - Raw user object from Prisma
 * @param {boolean} includePassword - Whether to include password in response
 * @returns {Object|null} Transformed user object or null
 */
function transformUser(dbUser, includePassword = false) {
  if (!dbUser) return null;

  const user = {
    id: dbUser.user_id.toString(),
    username: dbUser.username,
    email: dbUser.email,
    fullName: dbUser.full_name,
    phoneNumber: dbUser.phone_number,
    avatarUrl: dbUser.avatar_url,
    isBan: dbUser.is_ban,
    isActivate: dbUser.is_activate,
    role: dbUser.roles?.role_name,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };

  if (includePassword) {
    user.password = dbUser.password;
  }

  return user;
}

/**
 * Generate a secure random password for OAuth users
 * These users authenticate via OAuth and don't need to know this password
 * @returns {string} Random 32-character hex string
 */
function generateSecureRandomPassword() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a unique username from email
 * Appends timestamp to handle duplicate usernames
 * @param {string} email - User's email address
 * @returns {string} Unique username
 */
function generateUsernameFromEmail(email) {
  const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now().toString(36);
  return `${baseUsername}_${timestamp}`;
}

// =============================================================================
// USER RETRIEVAL FUNCTIONS
// =============================================================================

/**
 * Get user by database ID
 * @param {string|number} userId - User's database ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
export const getUserById = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { user_id: BigInt(userId) },
    select: USER_SELECT_FIELDS,
  });
  return transformUser(user);
};

/**
 * Get user by email address
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} User object or null if not found
 */
export const getUserByEmail = async (email) => {
  const user = await prisma.users.findUnique({
    where: { email },
    select: USER_SELECT_FIELDS,
  });
  return transformUser(user);
};

/**
 * Find user by email for authentication (includes password hash)
 * Use this only for login verification
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} User object with password or null
 */
export const findUserByIdentifier = async (identifier) => {
  const user = await prisma.users.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier }
      ]
    },
    select: AUTH_SELECT_FIELDS,
  });
  return transformUser(user, true);
};

export const checkExistingUser = async (email, username, phoneNumber, userId = null) => {
  // Create a flexible array of conditions to prevent Prisma errors if email or username or phone_number is empty/undefined
  const orConditions = [];
  if (email) orConditions.push({ email });
  if (username) orConditions.push({ username });
  if (phoneNumber) orConditions.push({ phone_number: phoneNumber });
  
  // If no values are provided, return false immediately without querying the database
  if (orConditions.length === 0) {
    return { emailExist: false, usernameExist: false, phoneNumberExist: false };
  }

  // Construct the where clause with OR conditions and optional NOT condition to exclude current user
  const whereClause = {
    OR: orConditions
  };
  //  Exclude the current user from the check if userId is provided (for updates)
  if (userId) {
    whereClause.NOT = {
      user_id: BigInt(userId),
    };
  }

  // Use findMany instead of findUnique because there might be 2 different users: 
  // one matching the email, and another matching the username
  const users = await prisma.users.findMany({
    where: whereClause,
    select: { email: true, username: true, phone_number: true },
  });

  // Check if the database results match the provided email or username
  return {
    emailExist: users.some(user => user.email === email),
    usernameExist: users.some(user => user.username === username),
    phoneNumberExist: users.some(user => user.phone_number === phoneNumber)
  };
}

// =============================================================================
// USER CREATION FUNCTIONS
// =============================================================================

/**
 * Create a new user account
 * @param {Object} userData - User data
 * @param {string} userData.email - User's email (required)
 * @param {string} userData.password - Hashed password (required)
 * @param {string} userData.username - Username (optional, generated from email if not provided)
 * @param {string} userData.phoneNumber - User's phone number (optional)
 * @param {string} userData.role - Role name (default: 'user')
 * @param {boolean} userData.isActivate - Account activation status (default: false)
 * @returns {Promise<Object>} Created user object
 * @throws {Error} If role is not found
 */
export const createUser = async (userData) => {
  const roleName = userData.role || DEFAULT_ROLE;
  
  // Find role by name
  const role = await prisma.roles.findUnique({
    where: { role_name: roleName },
  });

  if (!role) {
    throw new Error(`Role '${roleName}' not found in database`);
  }

  const user = await prisma.users.create({
    data: {
      username: userData.username || generateUsernameFromEmail(userData.email),
      email: userData.email,
      password: userData.password,
      phone_number: userData.phoneNumber || null,
      full_name: userData.fullName || null,
      avatar_url: null,
      role_id: role.role_id,
      is_activate: userData.isActivate ?? false, // Default to false if not provided
      is_ban: false,
    },
    select: USER_SELECT_FIELDS,
  });

  return transformUser(user);
};

// =============================================================================
// OAUTH FUNCTIONS
// =============================================================================

/**
 * Find existing user or create new one for OAuth authentication
 * Used for Google, Facebook, and other OAuth providers
 * 
 * @param {Object} oauthData - OAuth profile data
 * @param {string} oauthData.email - User's email from OAuth provider (required)
 * @param {string} oauthData.fullName - User's full name (optional)
 * @param {string} oauthData.avatarUrl - Profile picture URL (optional)
 * @returns {Promise<Object>} User object with isNewUser flag
 * @throws {Error} If default role is not found
 * 
 * @example
 * const user = await findOrCreateOAuthUser({
 *   email: 'user@gmail.com',
 *   fullName: 'John Doe',
 *   avatarUrl: 'https://...'
 * });
 */
export const findOrCreateOAuthUser = async ({ email, fullName, avatarUrl }) => {
  // Try to find existing user by email
  let user = await prisma.users.findUnique({
    where: { email },
    select: USER_SELECT_FIELDS,
  });

  if (user) {
    // User exists - return with isNewUser: false
    const transformedUser = transformUser(user);
    return { ...transformedUser, isNewUser: false };
  }

  // User doesn't exist - create new account
  const role = await prisma.roles.findUnique({
    where: { role_name: DEFAULT_ROLE },
  });

  if (!role) {
    throw new Error(`Default role '${DEFAULT_ROLE}' not found in database`);
  }

  // Create new user with OAuth data
  // Password is randomly generated (OAuth users don't use password login)
  user = await prisma.users.create({
    data: {
      username: generateUsernameFromEmail(email),
      email,
      password: generateSecureRandomPassword(),
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
      role_id: role.role_id,
      is_activate: true, // OAuth accounts are pre-verified
      is_ban: false,
    },
    select: USER_SELECT_FIELDS,
  });

  const transformedUser = transformUser(user);
  return { ...transformedUser, isNewUser: true };
};

// =============================================================================
// EXPORTS
// =============================================================================

export const authService = {
  // User retrieval
  getUserById,
  getUserByEmail,
  findUserByIdentifier,
  // User creation
  createUser,
  // OAuth
  findOrCreateOAuthUser,
  checkExistingUser,
};