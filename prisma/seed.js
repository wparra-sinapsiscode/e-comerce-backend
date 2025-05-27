import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ecommerce.com' },
    update: {},
    create: {
      email: 'admin@ecommerce.com',
      phone: '+51987654321',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: true,
      phoneVerified: true,
      address: 'Dirección del administrador',
      preferences: {
        notifications: true,
        marketing_emails: false,
        language: 'es'
      }
    },
  })

  console.log('✅ Admin user created:', adminUser.email)

  // Create customer user for testing
  const customerPassword = await bcrypt.hash('customer123', 12)
  
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      email: 'customer@test.com',
      phone: '+51987654322',
      name: 'Cliente de Prueba',
      password: customerPassword,
      role: 'CUSTOMER',
      emailVerified: true,
      phoneVerified: true,
      address: 'Av. Ejemplo 123, Lima, Perú',
      preferences: {
        notifications: true,
        marketing_emails: true,
        language: 'es'
      }
    },
  })

  console.log('✅ Customer user created:', customerUser.email)

  // Create categories
  const categories = [
    { name: 'Frutas', icon: 'Apple', color: '#e74c3c', sortOrder: 1 },
    { name: 'Verduras', icon: 'Carrot', color: '#2ecc71', sortOrder: 2 },
    { name: 'Lácteos', icon: 'Milk', color: '#3498db', sortOrder: 3 },
    { name: 'Carnes', icon: 'Drumstick', color: '#e67e22', sortOrder: 4 },
    { name: 'Pescados', icon: 'Fish', color: '#1abc9c', sortOrder: 5 },
    { name: 'Panadería', icon: 'Bread', color: '#f39c12', sortOrder: 6 },
    { name: 'Bebidas', icon: 'Wine', color: '#9b59b6', sortOrder: 7 },
    { name: 'Abarrotes', icon: 'ShoppingBasket', color: '#34495e', sortOrder: 8 },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    })
  }

  console.log('✅ Categories created')

  // Create sample products
  const frutasCategory = await prisma.category.findUnique({ where: { name: 'Frutas' } })
  const verdurasCategory = await prisma.category.findUnique({ where: { name: 'Verduras' } })
  const lacteosCategory = await prisma.category.findUnique({ where: { name: 'Lácteos' } })

  if (frutasCategory) {
    await prisma.product.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Manzana Roja',
        categoryId: frutasCategory.id,
        price: 8.50,
        unit: 'KG',
        description: 'Manzanas rojas frescas y crujientes',
        image: null,
      },
    })

    await prisma.product.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'Plátano',
        categoryId: frutasCategory.id,
        price: 3.20,
        unit: 'KG',
        description: 'Plátanos maduros de la selva',
        image: null,
      },
    })
  }

  if (verdurasCategory) {
    await prisma.product.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: 'Tomate',
        categoryId: verdurasCategory.id,
        price: 6.80,
        unit: 'KG',
        description: 'Tomates frescos para ensaladas',
        image: null,
      },
    })

    await prisma.product.upsert({
      where: { id: 4 },
      update: {},
      create: {
        name: 'Cebolla',
        categoryId: verdurasCategory.id,
        price: 4.50,
        unit: 'KG',
        description: 'Cebollas blancas frescas',
        image: null,
      },
    })
  }

  if (lacteosCategory) {
    await prisma.product.upsert({
      where: { id: 5 },
      update: {},
      create: {
        name: 'Leche Entera',
        categoryId: lacteosCategory.id,
        price: 4.80,
        unit: 'L',
        description: 'Leche fresca entera',
        image: null,
      },
    })
  }

  console.log('✅ Sample products created')

  console.log('\n🎉 Database seed completed successfully!')
  console.log('\n📝 Test credentials:')
  console.log('👨‍💼 Admin: admin@ecommerce.com / admin123')
  console.log('👤 Customer: customer@test.com / customer123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })