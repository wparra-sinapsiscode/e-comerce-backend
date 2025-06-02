import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  commonErrors,
  businessErrors,
  dbErrors,
} from '../utils/responses.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

// Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `ORD-${timestamp.slice(-6)}${random}`
}

// Calculate tax (18% in Peru)
function calculateTax(subtotal) {
  return Math.round(subtotal * 0.18 * 100) / 100
}

// Format order response
function formatOrderResponse(order) {
  return {
    id: order.id,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    customer_email: order.customerEmail,
    customer_address: order.customerAddress,
    customer_reference: order.customerReference,
    user_id: order.userId,
    date: order.date,
    status: order.status,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    subtotal: parseFloat(order.subtotal),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    notes: order.notes,
    delivery_date: order.deliveryDate,
    delivery_notes: order.deliveryNotes,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    items: order.items?.map(item => ({
      id: item.id,
      product_id: item.productId,
      presentation_id: item.presentationId,
      product_name: item.productName,
      quantity: parseFloat(item.quantity),
      price: parseFloat(item.price),
      total: parseFloat(item.total),
      presentation_info: item.presentationInfo,
      product: item.product,
      presentation: item.presentation
    })),
    user: order.user,
    payments: order.payments,
    status_history: order.statusHistory
  }
}

/**
 * Get all orders with optional filters (Admin only)
 */
export async function getAll(req, res) {
  try {
    console.log('🎯 BACKEND getAll: Ruta /orders alcanzada exitosamente (Admin)');
    console.log('✅ BACKEND getAll: Solicitud recibida. Usuario autenticado:', req.user);
    
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      paymentMethod,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query

    // Build where clause
    const where = {}
    
    if (status) {
      where.status = status
    }
    
    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }
    
    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }
    
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    // Build orderBy clause
    const orderBy = {}
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc'

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    console.log('🔍 BACKEND getAll: Filtro para la consulta de Prisma:', where);
    console.log('🔍 BACKEND getAll: Parámetros de paginación:', { page, limit, skip, take });

    // Get orders with related data
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          payments: true
        }
      }),
      prisma.order.count({ where })
    ])

    console.log('🗄️ BACKEND getAll: Pedidos encontrados en la BD:', orders.length, 'de', total);
    console.log('🗄️ BACKEND getAll: Primeros 2 pedidos:', orders.slice(0, 2));

    // Format response
    const formattedOrders = orders.map(formatOrderResponse)

    logger.info(`Retrieved ${orders.length} orders`)

    res.json(paginatedResponse(formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    console.error('❌ BACKEND getAll: ¡ERROR CRÍTICO! Fallo al obtener todos los pedidos:', error);
    logger.error('Get orders error:', error)
    res.status(500).json({ success: false, error: 'Error interno al obtener todos los pedidos.' });
  }
}

/**
 * Get order by ID
 */
export async function getById(req, res) {
  try {
    const { id } = req.params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            presentation: true
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        },
        payments: true,
        statusHistory: {
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    if (!order) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Check permissions - users can only see their own orders
    if (req.user?.role !== 'ADMIN' && req.user?.id !== order.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    logger.info(`Retrieved order: ${order.id}`)
    res.json(successResponse(formatOrderResponse(order)))
  } catch (error) {
    logger.error('Get order error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Create new order
 */
export async function create(req, res) {
  try {
    console.log('✅ BACKEND /orders: Solicitud recibida. Body:', req.body);
    
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_reference,
      payment_method,
      notes,
      delivery_date,
      delivery_notes,
      items
    } = req.body

    console.log('🔍 BACKEND /orders: Validando datos...');
    
    // Validate required fields
    if (!customer_name || !customer_phone || !customer_address || !payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json(commonErrors.badRequest('Missing required fields'))
    }

    // Generate unique order ID
    const orderId = generateOrderId()

    console.log('🗄️ BACKEND /orders: Intentando crear orden en la BD con:', {
      orderId,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      payment_method,
      items
    });
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0
      const orderItems = []

      // Process each item and validate products
      for (const item of items) {
        const { product_id, presentation_id, quantity } = item

        if (!product_id || !quantity || quantity <= 0) {
          throw new Error('Invalid item data')
        }

        // Get product
        const product = await tx.product.findUnique({
          where: { id: parseInt(product_id) },
          include: {
            presentations: true
          }
        })

        if (!product) {
          throw new Error(`Product ${product_id} not found`)
        }

        if (!product.active) {
          throw new Error(`Product ${product.name} is not active`)
        }

        let price = parseFloat(product.price)
        let productName = product.name
        let presentationInfo = null

        // If presentation is specified, use presentation price
        if (presentation_id) {
          const presentation = product.presentations.find(p => p.id === parseInt(presentation_id))
          if (!presentation) {
            throw new Error(`Presentation ${presentation_id} not found for product ${product.name}`)
          }
          price = parseFloat(presentation.price)
          presentationInfo = {
            name: presentation.name,
            unit: presentation.unit
          }
        }

        const itemTotal = Math.round(price * parseFloat(quantity) * 100) / 100
        subtotal += itemTotal

        orderItems.push({
          productId: parseInt(product_id),
          presentationId: presentation_id ? parseInt(presentation_id) : null,
          productName,
          quantity: parseFloat(quantity),
          price,
          total: itemTotal,
          presentationInfo
        })
      }

      // Calculate tax and total
      const tax = calculateTax(subtotal)
      const total = Math.round((subtotal + tax) * 100) / 100

      // Create order
      const order = await tx.order.create({
        data: {
          id: orderId,
          customerName: customer_name,
          customerPhone: customer_phone,
          customerEmail: customer_email,
          customerAddress: customer_address,
          customerReference: customer_reference,
          userId: req.user.id,
          paymentMethod: payment_method.toUpperCase(),
          subtotal,
          tax,
          total,
          notes,
          deliveryDate: delivery_date ? new Date(delivery_date) : null,
          deliveryNotes: delivery_notes,
          items: {
            create: orderItems
          }
        },
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      // Create initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'AWAITING_PAYMENT',
          notes: 'Order created',
          updatedBy: req.user?.email || 'system'
        }
      })

      return order
    })

    logger.info(`Order created: ${result.id} for ${result.customerName}`)
    res.status(201).json(successResponse(formatOrderResponse(result)))
  } catch (error) {
    console.error('❌ BACKEND /orders: ¡ERROR CRÍTICO! Fallo al procesar la orden:', error);
    logger.error('Create order error:', error)
    
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(400).json(errorResponse(error.message, 'INVALID_PRODUCT'))
    }
    
    if (error.message.includes('Invalid item data')) {
      return res.status(400).json(errorResponse('Invalid item data', 'INVALID_ITEMS'))
    }
    
    // Envía una respuesta de error detallada al frontend
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        stack: error.stack, // Incluimos el stack trace para depuración
      }
    });
  }
}

/**
 * Get my orders (authenticated user)
 */
export async function getMyOrders(req, res) {
  try {
    console.log('🎯 BACKEND get-my-orders: Ruta /my-orders alcanzada exitosamente');
    console.log('✅ BACKEND get-my-orders: Solicitud recibida. Usuario autenticado:', req.user);
    
    const { page = 1, limit = 10 } = req.query

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const whereClause = { userId: req.user.id }
    console.log('🔍 BACKEND get-my-orders: Filtro para la consulta de Prisma:', whereClause);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          payments: true
        }
      }),
      prisma.order.count({ where: whereClause })
    ])

    console.log('🗄️ BACKEND get-my-orders: Pedidos encontrados en la BD:', orders);

    const formattedOrders = orders.map(formatOrderResponse)

    logger.info(`Retrieved ${orders.length} orders for user ${req.user.id}`)

    res.json(paginatedResponse(formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    console.error('❌ BACKEND get-my-orders: ¡ERROR CRÍTICO! Fallo al obtener los pedidos:', error);
    logger.error('Get my orders error:', error)
    res.status(500).json({ success: false, error: 'Error interno al obtener los pedidos.' });
  }
}

/**
 * Get orders by customer phone (kept for admin use)
 */
export async function getByCustomerPhone(req, res) {
  try {
    console.log('✅ BACKEND get-orders: Solicitud recibida. Usuario autenticado:', req.user);
    
    const { phone } = req.params
    const { page = 1, limit = 10 } = req.query

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const whereClause = { customerPhone: phone }
    console.log('🔍 BACKEND get-orders: Filtro para la consulta de Prisma:', whereClause);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          payments: true
        }
      }),
      prisma.order.count({ where: whereClause })
    ])

    console.log('🗄️ BACKEND get-orders: Pedidos encontrados en la BD:', orders);

    const formattedOrders = orders.map(formatOrderResponse)

    logger.info(`Retrieved ${orders.length} orders for phone ${phone}`)

    res.json(paginatedResponse(formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    console.error('❌ BACKEND get-orders: ¡ERROR CRÍTICO! Fallo al obtener los pedidos:', error);
    logger.error('Get orders by customer phone error:', error)
    res.status(500).json({ success: false, error: 'Error interno al obtener los pedidos.' });
  }
}

/**
 * Get orders by status (Admin only)
 */
export async function getByStatus(req, res) {
  try {
    const { status } = req.params
    const { page = 1, limit = 20 } = req.query

    // Validate status
    const validStatuses = ['AWAITING_PAYMENT', 'PREPARING', 'READY_FOR_SHIPPING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json(commonErrors.badRequest('Invalid status'))
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          payments: true
        }
      }),
      prisma.order.count({ where: { status } })
    ])

    const formattedOrders = orders.map(formatOrderResponse)

    logger.info(`Retrieved ${orders.length} orders with status ${status}`)

    res.json(paginatedResponse(formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Get orders by status error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Update order status (Admin only)
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params
    const { status, notes } = req.body

    // Validate status
    const validStatuses = ['AWAITING_PAYMENT', 'PREPARING', 'READY_FOR_SHIPPING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json(commonErrors.badRequest('Invalid status'))
    }

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id }
    })

    if (!existingOrder) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Update order status in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status },
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      // Add to status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          notes,
          updatedBy: req.user?.email || 'admin'
        }
      })

      return updatedOrder
    })

    logger.info(`Order ${id} status updated to ${status} by ${req.user?.email}`)
    res.json(successResponse(formatOrderResponse(result)))
  } catch (error) {
    logger.error('Update order status error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get order items
 */
export async function getOrderItems(req, res) {
  try {
    const { id } = req.params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            presentation: true
          }
        }
      }
    })

    if (!order) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && req.user?.id !== order.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    const formattedItems = order.items.map(item => ({
      id: item.id,
      product_id: item.productId,
      presentation_id: item.presentationId,
      product_name: item.productName,
      quantity: parseFloat(item.quantity),
      price: parseFloat(item.price),
      total: parseFloat(item.total),
      presentation_info: item.presentationInfo,
      product: item.product,
      presentation: item.presentation
    }))

    logger.info(`Retrieved ${order.items.length} items for order ${id}`)
    res.json(successResponse(formattedItems))
  } catch (error) {
    logger.error('Get order items error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get order statistics (Admin only)
 */
export async function getStats(req, res) {
  try {
    const { period = '30d' } = req.query
    
    // Calculate date range
    let dateFrom = new Date()
    switch (period) {
      case '7d':
        dateFrom.setDate(dateFrom.getDate() - 7)
        break
      case '30d':
        dateFrom.setDate(dateFrom.getDate() - 30)
        break
      case '90d':
        dateFrom.setDate(dateFrom.getDate() - 90)
        break
      case '1y':
        dateFrom.setFullYear(dateFrom.getFullYear() - 1)
        break
      default:
        dateFrom.setDate(dateFrom.getDate() - 30)
    }

    const stats = await Promise.all([
      // Total orders
      prisma.order.count(),
      // Orders in period
      prisma.order.count({
        where: { createdAt: { gte: dateFrom } }
      }),
      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      // Orders by payment method
      prisma.order.groupBy({
        by: ['paymentMethod'],
        _count: { paymentMethod: true }
      }),
      // Total revenue
      prisma.order.aggregate({
        _sum: { total: true },
        where: { 
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom }
        }
      }),
      // Average order value
      prisma.order.aggregate({
        _avg: { total: true },
        where: { 
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom }
        }
      })
    ])

    const result = {
      total_orders: stats[0],
      orders_in_period: stats[1],
      orders_by_status: stats[2].reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {}),
      orders_by_payment_method: stats[3].reduce((acc, item) => {
        acc[item.paymentMethod] = item._count.paymentMethod
        return acc
      }, {}),
      total_revenue: parseFloat(stats[4]._sum.total || 0),
      average_order_value: parseFloat(stats[5]._avg.total || 0)
    }

    logger.info('Order statistics retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get order stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Search orders (Admin only)
 */
export async function search(req, res) {
  try {
    const { 
      q: query,
      page = 1,
      limit = 20,
      status,
      dateFrom,
      dateTo
    } = req.query

    if (!query) {
      return res.status(400).json(commonErrors.badRequest('Search query required'))
    }

    // Build where clause
    const where = {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { customerName: { contains: query, mode: 'insensitive' } },
        { customerPhone: { contains: query, mode: 'insensitive' } },
        { customerEmail: { contains: query, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ])

    const formattedOrders = orders.map(formatOrderResponse)

    logger.info(`Search "${query}" returned ${orders.length} orders`)

    res.json(paginatedResponse(formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }))
  } catch (error) {
    logger.error('Search orders error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Cancel order
 */
export async function cancel(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id }
    })

    if (!existingOrder) {
      return res.status(404).json(commonErrors.notFound('Order'))
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && req.user?.id !== existingOrder.userId) {
      return res.status(403).json(commonErrors.forbidden())
    }

    // Check if order can be cancelled
    if (existingOrder.status === 'CANCELLED') {
      return res.status(400).json(errorResponse('Order is already cancelled', 'ORDER_ALREADY_CANCELLED'))
    }

    if (existingOrder.status === 'DELIVERED') {
      return res.status(400).json(errorResponse('Cannot cancel delivered order', 'ORDER_ALREADY_DELIVERED'))
    }

    // Cancel order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          items: {
            include: {
              product: true,
              presentation: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      // Add to status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'CANCELLED',
          notes: reason || 'Order cancelled',
          updatedBy: req.user?.email || 'system'
        }
      })

      return updatedOrder
    })

    logger.info(`Order ${id} cancelled by ${req.user?.email || 'customer'}`)
    res.json(successResponse(formatOrderResponse(result)))
  } catch (error) {
    logger.error('Cancel order error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  getAll,
  getById,
  create,
  getMyOrders,
  getByCustomerPhone,
  getByStatus,
  updateStatus,
  getOrderItems,
  getStats,
  search,
  cancel
}