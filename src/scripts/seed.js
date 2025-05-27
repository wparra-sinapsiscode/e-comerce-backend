import 'dotenv/config'
import { getPrismaClient } from '../config/database.js'
import bcrypt from 'bcryptjs'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

const seedData = {
  categories: [
    {
      name: 'Frutas',
      icon: '🍎',
      color: '#FF6B6B',
      sortOrder: 1
    },
    {
      name: 'Verduras',
      icon: '🥬',
      color: '#4ECDC4',
      sortOrder: 2
    },
    {
      name: 'Carnes',
      icon: '🥩',
      color: '#45B7D1',
      sortOrder: 3
    },
    {
      name: 'Lácteos',
      icon: '🥛',
      color: '#96CEB4',
      sortOrder: 4
    },
    {
      name: 'Panadería',
      icon: '🍞',
      color: '#FECA57',
      sortOrder: 5
    },
    {
      name: 'Bebidas',
      icon: '🥤',
      color: '#FF9FF3',
      sortOrder: 6
    }
  ],

  products: [
    // Frutas
    {
      categoryName: 'Frutas',
      name: 'Manzana Roja',
      price: 2.50,
      unit: 'KG',
      description: 'Manzanas rojas frescas y dulces',
      image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400'
    },
    {
      categoryName: 'Frutas',
      name: 'Plátano',
      price: 1.80,
      unit: 'KG',
      description: 'Plátanos maduros y nutritivos',
      image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400'
    },
    {
      categoryName: 'Frutas',
      name: 'Naranja',
      price: 2.20,
      unit: 'KG',
      description: 'Naranjas jugosas para jugo o consumo directo',
      image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400'
    },
    {
      categoryName: 'Frutas',
      name: 'Palta',
      price: 3.50,
      unit: 'U',
      description: 'Paltas cremosas perfectas para ensaladas',
      image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400'
    },

    // Verduras
    {
      categoryName: 'Verduras',
      name: 'Lechuga',
      price: 1.50,
      unit: 'U',
      description: 'Lechuga fresca para ensaladas',
      image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400'
    },
    {
      categoryName: 'Verduras',
      name: 'Tomate',
      price: 3.20,
      unit: 'KG',
      description: 'Tomates rojos maduros',
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400'
    },
    {
      categoryName: 'Verduras',
      name: 'Cebolla',
      price: 1.80,
      unit: 'KG',
      description: 'Cebollas blancas frescas',
      image: 'https://images.unsplash.com/photo-1618512496848-2a8e2b4ab4a2?w=400'
    },
    {
      categoryName: 'Verduras',
      name: 'Zanahoria',
      price: 2.50,
      unit: 'KG',
      description: 'Zanahorias dulces y crujientes',
      image: 'https://images.unsplash.com/photo-1582515073490-39981397c445?w=400'
    },

    // Carnes
    {
      categoryName: 'Carnes',
      name: 'Pollo Entero',
      price: 8.90,
      unit: 'KG',
      description: 'Pollo fresco de granja',
      image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400'
    },
    {
      categoryName: 'Carnes',
      name: 'Carne de Res',
      price: 18.50,
      unit: 'KG',
      description: 'Carne de res premium para bistec',
      image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400'
    },
    {
      categoryName: 'Carnes',
      name: 'Pescado Fresco',
      price: 12.00,
      unit: 'KG',
      description: 'Pescado fresco del día',
      image: 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400'
    },

    // Lácteos
    {
      categoryName: 'Lácteos',
      name: 'Leche Entera',
      price: 3.80,
      unit: 'L',
      description: 'Leche entera fresca 1 litro',
      image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400'
    },
    {
      categoryName: 'Lácteos',
      name: 'Queso Fresco',
      price: 8.50,
      unit: 'KG',
      description: 'Queso fresco artesanal',
      image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400'
    },
    {
      categoryName: 'Lácteos',
      name: 'Yogurt Natural',
      price: 4.20,
      unit: 'U',
      description: 'Yogurt natural cremoso 500ml',
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400'
    },

    // Panadería
    {
      categoryName: 'Panadería',
      name: 'Pan Integral',
      price: 2.80,
      unit: 'U',
      description: 'Pan integral artesanal',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
    },
    {
      categoryName: 'Panadería',
      name: 'Croissant',
      price: 1.50,
      unit: 'U',
      description: 'Croissant mantequilloso y hojaldrado',
      image: 'https://images.unsplash.com/photo-1555507036-ab794f77665e?w=400'
    },

    // Bebidas
    {
      categoryName: 'Bebidas',
      name: 'Agua Mineral',
      price: 1.20,
      unit: 'L',
      description: 'Agua mineral natural 500ml',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400'
    },
    {
      categoryName: 'Bebidas',
      name: 'Jugo de Naranja',
      price: 4.50,
      unit: 'L',
      description: 'Jugo de naranja natural 1 litro',
      image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400'
    }
  ]
}

async function seed() {
  try {
    logger.info('🌱 Starting database seed...')

    // Clear existing data
    logger.info('🧹 Cleaning existing data...')
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    
    // Create admin user if doesn't exist
    logger.info('👤 Creating admin user...')
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12)
      await prisma.user.create({
        data: {
          email: 'admin@example.com',
          phone: '+51987654321',
          name: 'Administrador',
          password: hashedPassword,
          role: 'ADMIN',
          active: true,
          emailVerified: true,
          phoneVerified: true
        }
      })
      logger.info('✅ Admin user created')
    } else {
      logger.info('ℹ️ Admin user already exists')
    }

    // Create sample customer
    const existingCustomer = await prisma.user.findUnique({
      where: { email: 'customer@example.com' }
    })

    if (!existingCustomer) {
      const hashedPassword = await bcrypt.hash('customer123', 12)
      await prisma.user.create({
        data: {
          email: 'customer@example.com',
          phone: '+51912345678',
          name: 'Cliente Demo',
          password: hashedPassword,
          role: 'CUSTOMER',
          active: true,
          emailVerified: true,
          phoneVerified: true,
          address: 'Lima, Perú'
        }
      })
      logger.info('✅ Customer user created')
    } else {
      logger.info('ℹ️ Customer user already exists')
    }

    // Create categories
    logger.info('📂 Creating categories...')
    const createdCategories = {}
    
    for (const categoryData of seedData.categories) {
      const category = await prisma.category.create({
        data: categoryData
      })
      createdCategories[category.name] = category
      logger.info(`✅ Created category: ${category.name}`)
    }

    // Create products
    logger.info('📦 Creating products...')
    
    for (const productData of seedData.products) {
      const category = createdCategories[productData.categoryName]
      if (!category) {
        logger.warn(`⚠️ Category ${productData.categoryName} not found for product ${productData.name}`)
        continue
      }

      const { categoryName, ...productFields } = productData
      await prisma.product.create({
        data: {
          ...productFields,
          categoryId: category.id
        }
      })
      logger.info(`✅ Created product: ${productData.name}`)
    }

    // Create sample presentations for some products
    logger.info('📋 Creating sample presentations...')
    
    const products = await prisma.product.findMany({
      include: { category: true }
    })

    // Add presentations for some products
    const productPresentations = [
      {
        productName: 'Manzana Roja',
        presentations: [
          { name: 'Bolsa 5kg', price: 12.00, unit: '5KG', sortOrder: 1 },
          { name: 'Caja 10kg', price: 22.00, unit: '10KG', sortOrder: 2 }
        ]
      },
      {
        productName: 'Leche Entera',
        presentations: [
          { name: 'Pack 6 litros', price: 20.00, unit: '6L', sortOrder: 1 },
          { name: 'Caja 12 litros', price: 38.00, unit: '12L', sortOrder: 2 }
        ]
      }
    ]

    for (const prodPres of productPresentations) {
      const product = products.find(p => p.name === prodPres.productName)
      if (product) {
        for (const presentation of prodPres.presentations) {
          await prisma.presentation.create({
            data: {
              ...presentation,
              productId: product.id
            }
          })
          logger.info(`✅ Created presentation: ${presentation.name} for ${product.name}`)
        }
      }
    }

    // Summary
    const categoriesCount = await prisma.category.count()
    const productsCount = await prisma.product.count()
    const presentationsCount = await prisma.presentation.count()
    const usersCount = await prisma.user.count()

    logger.info('🎉 Database seeded successfully!')
    logger.info(`📊 Summary:`)
    logger.info(`   👤 Users: ${usersCount}`)
    logger.info(`   📂 Categories: ${categoriesCount}`)
    logger.info(`   📦 Products: ${productsCount}`)
    logger.info(`   📋 Presentations: ${presentationsCount}`)

  } catch (error) {
    logger.error('❌ Error seeding database:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seed()
    .catch((error) => {
      logger.error('Seed failed:', error)
      process.exit(1)
    })
}

export default seed