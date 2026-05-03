import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

const DEFAULT_SUPER_ADMIN_NAME = '系统管理员'

function getDefaultSuperAdminConfig() {
  const email = process.env.DEFAULT_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.DEFAULT_SUPER_ADMIN_PASSWORD?.trim()

  if (!email || !password) {
    return null
  }

  return {
    email,
    password,
    name: process.env.DEFAULT_SUPER_ADMIN_NAME?.trim() || DEFAULT_SUPER_ADMIN_NAME,
  }
}

export async function ensureDefaultSuperAdmin() {
  const config = getDefaultSuperAdminConfig()
  if (!config) {
    return { created: false, enabled: false }
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true },
    select: { id: true },
  })

  if (existingSuperAdmin) {
    return { created: false, enabled: true }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: config.email },
    select: { id: true, isSuperAdmin: true },
  })

  if (existingUser) {
    if (!existingUser.isSuperAdmin) {
      console.warn(
        `[auth] DEFAULT_SUPER_ADMIN_EMAIL=${config.email} already exists but is not a super admin. ` +
        'Automatic promotion was skipped for safety.'
      )
    }

    return { created: false, enabled: true, skipped: 'email_in_use' }
  }

  const hashedPassword = await hashPassword(config.password)
  await prisma.user.create({
    data: {
      email: config.email,
      name: config.name,
      password: hashedPassword,
      role: 'admin',
      isSuperAdmin: true,
    },
  })

  return {
    created: true,
    enabled: true,
    email: config.email,
  }
}
