/**
 * Script: Create Admin User
 * Project: Book Recommendation System
 *
 * Description:
 *   Creates a new admin user in the database.
 *   Uses bcrypt to hash the password and Prisma client to insert the record.
 *
 * Usage:
 *   1. Make sure your DATABASE_URL in .env points to the target database (Supabase).
 *   2. Run: node scripts/create_admin.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Configurable Admin Details via Env or Hardcoded Defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "tekbook_admin";
const ADMIN_FULLNAME = process.env.ADMIN_FULLNAME || "TekBook Administrator";

const prisma = new PrismaClient();

async function main() {
  console.log("============================================================");
  console.log("      Create Admin User — Book Recommendation System");
  console.log("============================================================");

  // 1. Ensure Roles table has the 'ADMIN' role
  console.log("\n1. Verifying admin role in database...");
  let adminRole = await prisma.roles.findFirst({
    where: {
      role_name: {
        in: ["ADMIN", "admin"],
      },
    },
  });

  if (!adminRole) {
    console.log("   Role 'ADMIN' not found. Creating it now...");
    adminRole = await prisma.roles.create({
      data: { role_name: "ADMIN" },
    });
  }
  console.log(`   ✓ Found admin role (ID: ${adminRole.role_id}, Name: '${adminRole.role_name}')`);

  // 2. Check if user already exists
  console.log("\n2. Checking if email or username already exists...");
  const existingUser = await prisma.users.findFirst({
    where: {
      OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }],
    },
  });

  if (existingUser) {
    console.log(`   ❌ User already exists:`);
    console.log(`      Username: ${existingUser.username}`);
    console.log(`      Email:    ${existingUser.email}`);
    console.log(`      Role ID:  ${existingUser.role_id}`);
    console.log("\n   No action taken. Please choose different credentials.");
    return;
  }

  // 3. Hash Password
  console.log("\n3. Hashing password...");
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
  console.log("   ✓ Password hashed successfully.");

  // 4. Create Admin User
  console.log("\n4. Creating admin user...");
  const newAdmin = await prisma.users.create({
    data: {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      full_name: ADMIN_FULLNAME,
      is_activate: true, // Auto-activate admin account
      is_ban: false,
      role_id: adminRole.role_id,
    },
  });

  console.log("\n============================================================");
  console.log("  🎉 ADMIN USER CREATED SUCCESSFULLY");
  console.log("============================================================");
  console.log(`  User ID:   ${newAdmin.user_id}`);
  console.log(`  Username:  ${newAdmin.username}`);
  console.log(`  Email:     ${newAdmin.email}`);
  console.log(`  Password:  ${ADMIN_PASSWORD}  (Please change it after login!)`);
  console.log(`  Role:      ${adminRole.role_name}`);
  console.log("============================================================");
}

main()
  .catch((err) => {
    console.error("\n❌ Error creating admin user:", err.message);
    console.error(err.stack);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n🔌 Disconnected from database.");
  });
