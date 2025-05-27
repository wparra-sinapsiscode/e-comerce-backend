import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  commonErrors,
} from '../utils/responses.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

/**
 * Get dashboard overview with general statistics
 */
export async function getOverview(req, res) {
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
      // Total orders and revenue
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total: true },
        where: { 
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom }
        }
      }),
      
      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { createdAt: { gte: dateFrom } }
      }),
      
      // Total customers
      prisma.user.count({
        where: { role: 'CUSTOMER' }
      }),
      
      // New customers in period
      prisma.user.count({
        where: { 
          role: 'CUSTOMER',
          createdAt: { gte: dateFrom }
        }
      }),
      
      // Total products
      prisma.product.count({
        where: { active: true }
      }),
      
      // Total categories
      prisma.category.count({
        where: { active: true }
      }),
      
      // Pending payments
      prisma.payment.count({
        where: { status: 'PENDING' }
      }),
      
      // Average order value
      prisma.order.aggregate({
        _avg: { total: true },
        where: { 
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom }
        }
      }),
      
      // Orders requiring action (preparing, ready for shipping)
      prisma.order.count({
        where: {
          status: { in: ['PREPARING', 'READY_FOR_SHIPPING'] }
        }
      }),
      
      // Recent orders (last 24 hours)
      prisma.order.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ])

    const result = {
      period,
      overview: {
        total_orders: stats[0]._count.id || 0,
        total_revenue: parseFloat(stats[0]._sum.total || 0),
        total_customers: stats[2] || 0,
        new_customers: stats[3] || 0,
        total_products: stats[4] || 0,
        total_categories: stats[5] || 0,
        pending_payments: stats[6] || 0,
        average_order_value: parseFloat(stats[7]._avg.total || 0),
        orders_requiring_action: stats[8] || 0,
        recent_orders_24h: stats[9] || 0
      },
      orders_by_status: stats[1].reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {}),
      growth_indicators: {
        revenue_growth: 0, // TODO: Calculate vs previous period
        customer_growth: stats[3] || 0,
        order_growth: 0 // TODO: Calculate vs previous period
      }
    }

    logger.info('Dashboard overview retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get dashboard overview error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get sales statistics with detailed breakdown
 */
export async function getSalesStats(req, res) {
  try {
    const { period = '30d', groupBy = 'day' } = req.query
    
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
    }

    // Get sales data grouped by period
    const salesData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, created_at) as period,
        COUNT(*) as order_count,
        SUM(total) as revenue,
        AVG(total) as avg_order_value
      FROM orders 
      WHERE created_at >= ${dateFrom} AND status != 'CANCELLED'
      GROUP BY DATE_TRUNC(${groupBy}, created_at)
      ORDER BY period ASC
    `

    // Get payment method breakdown
    const paymentStats = await prisma.order.groupBy({
      by: ['paymentMethod'],
      _count: { paymentMethod: true },
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: dateFrom }
      }
    })

    const result = {
      period,
      group_by: groupBy,
      sales_timeline: salesData.map(item => ({
        period: item.period,
        order_count: parseInt(item.order_count),
        revenue: parseFloat(item.revenue),
        avg_order_value: parseFloat(item.avg_order_value)
      })),
      payment_methods: paymentStats.map(item => ({
        method: item.paymentMethod,
        count: item._count.paymentMethod,
        revenue: parseFloat(item._sum.total || 0)
      })),
      totals: {
        total_orders: salesData.reduce((sum, item) => sum + parseInt(item.order_count), 0),
        total_revenue: salesData.reduce((sum, item) => sum + parseFloat(item.revenue), 0),
        average_order_value: salesData.length > 0 
          ? salesData.reduce((sum, item) => sum + parseFloat(item.avg_order_value), 0) / salesData.length 
          : 0
      }
    }

    logger.info('Sales statistics retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get sales stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get top selling products
 */
export async function getTopProducts(req, res) {
  try {
    const { limit = 10, period = '30d' } = req.query
    
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
    }

    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: {
        quantity: true,
        total: true
      },
      _count: {
        productId: true
      },
      where: {
        order: {
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom }
        }
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: parseInt(limit)
    })

    // Get product details
    const productIds = topProducts.map(item => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true }
    })

    const result = topProducts.map(item => {
      const product = products.find(p => p.id === item.productId)
      return {
        product_id: item.productId,
        product_name: item.productName,
        category: product?.category?.name || 'Unknown',
        total_quantity_sold: parseFloat(item._sum.quantity || 0),
        total_revenue: parseFloat(item._sum.total || 0),
        order_count: item._count.productId,
        average_price: parseFloat(item._sum.total || 0) / parseFloat(item._sum.quantity || 1),
        product_details: product ? {
          price: parseFloat(product.price),
          unit: product.unit,
          active: product.active,
          image: product.image
        } : null
      }
    })

    logger.info(`Top ${topProducts.length} products retrieved`)
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get top products error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get top categories by sales
 */
export async function getTopCategories(req, res) {
  try {
    const { limit = 10, period = '30d' } = req.query
    
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
    }

    // Get category sales data
    const categorySales = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        COUNT(oi.id) as total_items_sold,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total) as total_revenue,
        COUNT(DISTINCT o.id) as unique_orders
      FROM categories c
      INNER JOIN products p ON p.category_id = c.id
      INNER JOIN order_items oi ON oi.product_id = p.id
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= ${dateFrom} AND o.status != 'CANCELLED'
      GROUP BY c.id, c.name, c.icon, c.color
      ORDER BY total_revenue DESC
      LIMIT ${parseInt(limit)}
    `

    const result = categorySales.map(item => ({
      category_id: item.id,
      category_name: item.name,
      icon: item.icon,
      color: item.color,
      total_items_sold: parseInt(item.total_items_sold),
      total_quantity: parseFloat(item.total_quantity),
      total_revenue: parseFloat(item.total_revenue),
      unique_orders: parseInt(item.unique_orders),
      average_order_value: parseFloat(item.total_revenue) / parseInt(item.unique_orders)
    }))

    logger.info(`Top ${categorySales.length} categories retrieved`)
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get top categories error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get revenue by period with detailed breakdown
 */
export async function getRevenueByPeriod(req, res) {
  try {
    const { period = '30d', groupBy = 'day' } = req.query
    
    let dateFrom = new Date()
    let dateTo = new Date()
    
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
    }

    // Get revenue data
    const revenueData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, created_at) as period,
        SUM(total) as revenue,
        SUM(subtotal) as subtotal,
        SUM(tax) as tax,
        COUNT(*) as order_count,
        AVG(total) as avg_order_value
      FROM orders 
      WHERE created_at >= ${dateFrom} AND created_at <= ${dateTo} AND status != 'CANCELLED'
      GROUP BY DATE_TRUNC(${groupBy}, created_at)
      ORDER BY period ASC
    `

    // Calculate growth rates
    const revenueWithGrowth = revenueData.map((item, index) => {
      const previousItem = revenueData[index - 1]
      let growth_rate = 0
      
      if (previousItem && parseFloat(previousItem.revenue) > 0) {
        growth_rate = ((parseFloat(item.revenue) - parseFloat(previousItem.revenue)) / parseFloat(previousItem.revenue)) * 100
      }

      return {
        period: item.period,
        revenue: parseFloat(item.revenue),
        subtotal: parseFloat(item.subtotal),
        tax: parseFloat(item.tax),
        order_count: parseInt(item.order_count),
        avg_order_value: parseFloat(item.avg_order_value),
        growth_rate: Math.round(growth_rate * 100) / 100
      }
    })

    const totals = {
      total_revenue: revenueData.reduce((sum, item) => sum + parseFloat(item.revenue), 0),
      total_subtotal: revenueData.reduce((sum, item) => sum + parseFloat(item.subtotal), 0),
      total_tax: revenueData.reduce((sum, item) => sum + parseFloat(item.tax), 0),
      total_orders: revenueData.reduce((sum, item) => sum + parseInt(item.order_count), 0),
      overall_avg_order_value: revenueData.length > 0 
        ? revenueData.reduce((sum, item) => sum + parseFloat(item.avg_order_value), 0) / revenueData.length 
        : 0
    }

    const result = {
      period,
      group_by: groupBy,
      revenue_timeline: revenueWithGrowth,
      totals,
      summary: {
        highest_revenue_day: revenueWithGrowth.reduce((max, item) => 
          item.revenue > max.revenue ? item : max, revenueWithGrowth[0] || {}),
        lowest_revenue_day: revenueWithGrowth.reduce((min, item) => 
          item.revenue < min.revenue ? item : min, revenueWithGrowth[0] || {}),
        average_daily_revenue: totals.total_revenue / (revenueData.length || 1)
      }
    }

    logger.info('Revenue by period retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get revenue by period error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get customer statistics
 */
export async function getCustomerStats(req, res) {
  try {
    const { period = '30d' } = req.query
    
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
    }

    const stats = await Promise.all([
      // Total customers
      prisma.user.count({
        where: { role: 'CUSTOMER' }
      }),
      
      // New customers in period
      prisma.user.count({
        where: { 
          role: 'CUSTOMER',
          createdAt: { gte: dateFrom }
        }
      }),
      
      // Customers with orders
      prisma.order.groupBy({
        by: ['customerPhone'],
        _count: { customerPhone: true },
        where: {
          createdAt: { gte: dateFrom },
          status: { not: 'CANCELLED' }
        }
      }),
      
      // Top customers by order value
      prisma.$queryRaw`
        SELECT 
          customer_name,
          customer_phone,
          COUNT(*) as order_count,
          SUM(total) as total_spent,
          AVG(total) as avg_order_value,
          MAX(created_at) as last_order_date
        FROM orders 
        WHERE created_at >= ${dateFrom} AND status != 'CANCELLED'
        GROUP BY customer_name, customer_phone
        ORDER BY total_spent DESC
        LIMIT 10
      `
    ])

    const customerOrderStats = stats[2]
    const topCustomers = stats[3]

    const result = {
      period,
      overview: {
        total_customers: stats[0],
        new_customers: stats[1],
        customers_with_orders: customerOrderStats.length,
        customer_retention_rate: stats[0] > 0 ? (customerOrderStats.length / stats[0]) * 100 : 0
      },
      customer_segments: {
        new_customers: stats[1],
        repeat_customers: customerOrderStats.filter(c => c._count.customerPhone > 1).length,
        one_time_customers: customerOrderStats.filter(c => c._count.customerPhone === 1).length,
        vip_customers: customerOrderStats.filter(c => c._count.customerPhone >= 5).length
      },
      top_customers: topCustomers.map(customer => ({
        name: customer.customer_name,
        phone: customer.customer_phone,
        order_count: parseInt(customer.order_count),
        total_spent: parseFloat(customer.total_spent),
        avg_order_value: parseFloat(customer.avg_order_value),
        last_order_date: customer.last_order_date
      })),
      customer_behavior: {
        avg_orders_per_customer: customerOrderStats.length > 0 
          ? customerOrderStats.reduce((sum, c) => sum + c._count.customerPhone, 0) / customerOrderStats.length 
          : 0,
        repeat_customer_rate: customerOrderStats.length > 0 
          ? (customerOrderStats.filter(c => c._count.customerPhone > 1).length / customerOrderStats.length) * 100 
          : 0
      }
    }

    logger.info('Customer statistics retrieved')
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get customer stats error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get inventory alerts for low stock items
 */
export async function getInventoryAlerts(req, res) {
  try {
    const { threshold = 10 } = req.query

    // For now, we'll simulate stock levels since we don't have inventory tracking
    // In a real system, you'd have an inventory table
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        category: true,
        _count: {
          select: { orderItems: true }
        }
      }
    })

    // Simulate stock alerts based on order frequency
    const alerts = products
      .map(product => {
        // Simulate current stock (in real system, this would come from inventory table)
        const simulatedStock = Math.max(0, 100 - (product._count.orderItems * 2))
        
        return {
          product_id: product.id,
          product_name: product.name,
          category: product.category.name,
          current_stock: simulatedStock,
          threshold: parseInt(threshold),
          price: parseFloat(product.price),
          unit: product.unit,
          times_ordered: product._count.orderItems,
          status: simulatedStock <= parseInt(threshold) ? 'critical' : 
                  simulatedStock <= parseInt(threshold) * 2 ? 'warning' : 'ok'
        }
      })
      .filter(item => item.status !== 'ok')
      .sort((a, b) => a.current_stock - b.current_stock)

    const summary = {
      critical_items: alerts.filter(item => item.status === 'critical').length,
      warning_items: alerts.filter(item => item.status === 'warning').length,
      total_alerts: alerts.length,
      categories_affected: [...new Set(alerts.map(item => item.category))].length
    }

    const result = {
      threshold: parseInt(threshold),
      summary,
      alerts,
      recommendations: alerts.slice(0, 5).map(item => ({
        product_name: item.product_name,
        suggested_reorder_quantity: Math.max(50, item.times_ordered * 10),
        priority: item.status === 'critical' ? 'high' : 'medium'
      }))
    }

    logger.info(`Inventory alerts retrieved: ${alerts.length} items need attention`)
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get inventory alerts error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Get recent activity feed
 */
export async function getRecentActivity(req, res) {
  try {
    const { limit = 20 } = req.query

    const activities = await Promise.all([
      // Recent orders
      prisma.order.findMany({
        take: parseInt(limit) / 2,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          customerName: true,
          status: true,
          total: true,
          createdAt: true
        }
      }),
      
      // Recent payments
      prisma.payment.findMany({
        take: parseInt(limit) / 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderId: true,
          status: true,
          amount: true,
          method: true,
          createdAt: true,
          order: {
            select: { customerName: true }
          }
        }
      }),
      
      // Recent users
      prisma.user.findMany({
        take: parseInt(limit) / 4,
        orderBy: { createdAt: 'desc' },
        where: { role: 'CUSTOMER' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true
        }
      })
    ])

    // Combine and format activities
    const allActivities = []

    // Add order activities
    activities[0].forEach(order => {
      allActivities.push({
        type: 'order',
        title: `New order from ${order.customerName}`,
        description: `Order ${order.id} - ${order.status} - $${parseFloat(order.total)}`,
        timestamp: order.createdAt,
        metadata: {
          order_id: order.id,
          customer_name: order.customerName,
          status: order.status,
          amount: parseFloat(order.total)
        }
      })
    })

    // Add payment activities
    activities[1].forEach(payment => {
      allActivities.push({
        type: 'payment',
        title: `Payment ${payment.status.toLowerCase()}`,
        description: `${payment.method} payment for order ${payment.orderId} - $${parseFloat(payment.amount)}`,
        timestamp: payment.createdAt,
        metadata: {
          payment_id: payment.id,
          order_id: payment.orderId,
          customer_name: payment.order?.customerName,
          status: payment.status,
          method: payment.method,
          amount: parseFloat(payment.amount)
        }
      })
    })

    // Add user activities
    activities[2].forEach(user => {
      allActivities.push({
        type: 'user',
        title: `New customer registered`,
        description: `${user.name} (${user.email}) joined`,
        timestamp: user.createdAt,
        metadata: {
          user_id: user.id,
          name: user.name,
          email: user.email
        }
      })
    })

    // Sort by timestamp and limit
    const sortedActivities = allActivities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit))

    const summary = {
      total_activities: sortedActivities.length,
      activity_types: {
        orders: sortedActivities.filter(a => a.type === 'order').length,
        payments: sortedActivities.filter(a => a.type === 'payment').length,
        users: sortedActivities.filter(a => a.type === 'user').length
      },
      last_activity: sortedActivities[0]?.timestamp || null
    }

    const result = {
      summary,
      activities: sortedActivities,
      filters: {
        available_types: ['order', 'payment', 'user'],
        time_range: '24 hours'
      }
    }

    logger.info(`Recent activity retrieved: ${sortedActivities.length} activities`)
    res.json(successResponse(result))
  } catch (error) {
    logger.error('Get recent activity error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  getOverview,
  getSalesStats,
  getTopProducts,
  getTopCategories,
  getRevenueByPeriod,
  getCustomerStats,
  getInventoryAlerts,
  getRecentActivity
}