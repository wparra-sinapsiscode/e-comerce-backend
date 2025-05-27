import { getPrismaClient } from '../config/database.js'
import {
  successResponse,
  errorResponse,
  commonErrors,
} from '../utils/responses.js'
import logger from '../config/logger.js'

const prisma = getPrismaClient()

/**
 * Generate sales report with detailed breakdown
 */
export async function generateSalesReport(req, res) {
  try {
    const { 
      format = 'json',
      period = '30d',
      groupBy = 'day',
      includeItems = 'false'
    } = req.query
    
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
      case 'custom':
        if (req.query.dateFrom) dateFrom = new Date(req.query.dateFrom)
        if (req.query.dateTo) dateTo = new Date(req.query.dateTo)
        break
    }

    // Get sales data
    const salesData = await prisma.order.findMany({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { not: 'CANCELLED' }
      },
      include: {
        items: includeItems === 'true' ? {
          include: {
            product: {
              include: { category: true }
            },
            presentation: true
          }
        } : false,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate summary statistics
    const summary = {
      total_orders: salesData.length,
      total_revenue: salesData.reduce((sum, order) => sum + parseFloat(order.total), 0),
      total_subtotal: salesData.reduce((sum, order) => sum + parseFloat(order.subtotal), 0),
      total_tax: salesData.reduce((sum, order) => sum + parseFloat(order.tax), 0),
      average_order_value: salesData.length > 0 
        ? salesData.reduce((sum, order) => sum + parseFloat(order.total), 0) / salesData.length 
        : 0,
      orders_by_status: salesData.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
      }, {}),
      orders_by_payment_method: salesData.reduce((acc, order) => {
        acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1
        return acc
      }, {}),
      orders_by_payment_status: salesData.reduce((acc, order) => {
        acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1
        return acc
      }, {})
    }

    // Format orders data
    const formattedOrders = salesData.map(order => ({
      id: order.id,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_email: order.customerEmail,
      date: order.date,
      status: order.status,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      subtotal: parseFloat(order.subtotal),
      tax: parseFloat(order.tax),
      total: parseFloat(order.total),
      items_count: order.items?.length || 0,
      items: order.items?.map(item => ({
        product_name: item.productName,
        category: item.product?.category?.name,
        quantity: parseFloat(item.quantity),
        price: parseFloat(item.price),
        total: parseFloat(item.total),
        presentation: item.presentationInfo
      })),
      payments: order.payments?.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount),
        method: payment.method,
        status: payment.status,
        verified_at: payment.verifiedAt
      }))
    }))

    const report = {
      report_type: 'sales',
      generated_at: new Date().toISOString(),
      period: {
        type: period,
        from: dateFrom.toISOString(),
        to: dateTo.toISOString()
      },
      summary,
      orders: formattedOrders,
      metadata: {
        total_records: formattedOrders.length,
        include_items: includeItems === 'true',
        group_by: groupBy,
        format
      }
    }

    if (format === 'csv') {
      // Generate CSV format (simplified version)
      const csvHeaders = [
        'Order ID', 'Customer Name', 'Customer Phone', 'Date', 'Status',
        'Payment Method', 'Payment Status', 'Subtotal', 'Tax', 'Total'
      ]
      
      const csvRows = formattedOrders.map(order => [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.date,
        order.status,
        order.payment_method,
        order.payment_status,
        order.subtotal,
        order.tax,
        order.total
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.csv"`)
      return res.send(csvContent)
    }

    logger.info(`Sales report generated: ${formattedOrders.length} orders`)
    res.json(successResponse(report))
  } catch (error) {
    logger.error('Generate sales report error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Generate inventory report
 */
export async function generateInventoryReport(req, res) {
  try {
    const { format = 'json', includeInactive = 'false' } = req.query

    const products = await prisma.product.findMany({
      where: includeInactive === 'true' ? {} : { active: true },
      include: {
        category: true,
        presentations: true,
        _count: {
          select: { orderItems: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Calculate inventory metrics for each product
    const inventoryData = products.map(product => {
      // Simulate current stock (in real system, this would come from inventory table)
      const simulatedStock = Math.max(0, 100 - (product._count.orderItems * 2))
      
      return {
        product_id: product.id,
        product_name: product.name,
        category: product.category.name,
        price: parseFloat(product.price),
        unit: product.unit,
        active: product.active,
        current_stock: simulatedStock,
        times_ordered: product._count.orderItems,
        presentations_count: product.presentations.length,
        presentations: product.presentations.map(p => ({
          name: p.name,
          price: parseFloat(p.price),
          unit: p.unit
        })),
        stock_status: simulatedStock <= 10 ? 'critical' : 
                     simulatedStock <= 20 ? 'warning' : 'ok',
        estimated_value: simulatedStock * parseFloat(product.price),
        created_at: product.createdAt,
        updated_at: product.updatedAt
      }
    })

    const summary = {
      total_products: inventoryData.length,
      active_products: inventoryData.filter(p => p.active).length,
      inactive_products: inventoryData.filter(p => !p.active).length,
      critical_stock_items: inventoryData.filter(p => p.stock_status === 'critical').length,
      warning_stock_items: inventoryData.filter(p => p.stock_status === 'warning').length,
      total_estimated_value: inventoryData.reduce((sum, p) => sum + p.estimated_value, 0),
      categories_count: [...new Set(inventoryData.map(p => p.category))].length,
      stock_distribution: {
        critical: inventoryData.filter(p => p.stock_status === 'critical').length,
        warning: inventoryData.filter(p => p.stock_status === 'warning').length,
        ok: inventoryData.filter(p => p.stock_status === 'ok').length
      }
    }

    const report = {
      report_type: 'inventory',
      generated_at: new Date().toISOString(),
      summary,
      products: inventoryData,
      metadata: {
        total_records: inventoryData.length,
        include_inactive: includeInactive === 'true',
        format
      }
    }

    if (format === 'csv') {
      const csvHeaders = [
        'Product ID', 'Product Name', 'Category', 'Price', 'Unit', 'Active',
        'Current Stock', 'Times Ordered', 'Stock Status', 'Estimated Value'
      ]
      
      const csvRows = inventoryData.map(product => [
        product.product_id,
        product.product_name,
        product.category,
        product.price,
        product.unit,
        product.active,
        product.current_stock,
        product.times_ordered,
        product.stock_status,
        product.estimated_value
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"')
      return res.send(csvContent)
    }

    logger.info(`Inventory report generated: ${inventoryData.length} products`)
    res.json(successResponse(report))
  } catch (error) {
    logger.error('Generate inventory report error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Generate customer report
 */
export async function generateCustomerReport(req, res) {
  try {
    const { format = 'json', period = '30d' } = req.query
    
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

    // Get customer data with order statistics
    const customerData = await prisma.$queryRaw`
      SELECT 
        o.customer_name,
        o.customer_phone,
        o.customer_email,
        COUNT(o.id) as total_orders,
        SUM(o.total) as total_spent,
        AVG(o.total) as avg_order_value,
        MIN(o.created_at) as first_order_date,
        MAX(o.created_at) as last_order_date,
        COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled_orders
      FROM orders o
      WHERE o.created_at >= ${dateFrom}
      GROUP BY o.customer_name, o.customer_phone, o.customer_email
      ORDER BY total_spent DESC
    `

    // Get registered users data
    const registeredUsers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        createdAt: { gte: dateFrom }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        active: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        lastLogin: true
      }
    })

    const formattedCustomers = customerData.map(customer => ({
      name: customer.customer_name,
      phone: customer.customer_phone,
      email: customer.customer_email,
      total_orders: parseInt(customer.total_orders),
      total_spent: parseFloat(customer.total_spent),
      avg_order_value: parseFloat(customer.avg_order_value),
      first_order_date: customer.first_order_date,
      last_order_date: customer.last_order_date,
      delivered_orders: parseInt(customer.delivered_orders),
      cancelled_orders: parseInt(customer.cancelled_orders),
      customer_type: parseInt(customer.total_orders) >= 5 ? 'vip' : 
                    parseInt(customer.total_orders) > 1 ? 'repeat' : 'new',
      success_rate: parseInt(customer.total_orders) > 0 
        ? (parseInt(customer.delivered_orders) / parseInt(customer.total_orders)) * 100 
        : 0
    }))

    const summary = {
      total_customers: formattedCustomers.length,
      registered_users: registeredUsers.length,
      new_customers: formattedCustomers.filter(c => c.customer_type === 'new').length,
      repeat_customers: formattedCustomers.filter(c => c.customer_type === 'repeat').length,
      vip_customers: formattedCustomers.filter(c => c.customer_type === 'vip').length,
      total_revenue_from_customers: formattedCustomers.reduce((sum, c) => sum + c.total_spent, 0),
      average_customer_value: formattedCustomers.length > 0 
        ? formattedCustomers.reduce((sum, c) => sum + c.total_spent, 0) / formattedCustomers.length 
        : 0,
      customer_retention_rate: formattedCustomers.length > 0 
        ? (formattedCustomers.filter(c => c.customer_type !== 'new').length / formattedCustomers.length) * 100 
        : 0
    }

    const report = {
      report_type: 'customer',
      generated_at: new Date().toISOString(),
      period: {
        type: period,
        from: dateFrom.toISOString(),
        to: new Date().toISOString()
      },
      summary,
      customers: formattedCustomers,
      registered_users: registeredUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        active: user.active,
        email_verified: user.emailVerified,
        phone_verified: user.phoneVerified,
        registration_date: user.createdAt,
        last_login: user.lastLogin
      })),
      metadata: {
        total_records: formattedCustomers.length,
        registered_users_count: registeredUsers.length,
        period,
        format
      }
    }

    if (format === 'csv') {
      const csvHeaders = [
        'Name', 'Phone', 'Email', 'Total Orders', 'Total Spent', 'Avg Order Value',
        'First Order', 'Last Order', 'Customer Type', 'Success Rate'
      ]
      
      const csvRows = formattedCustomers.map(customer => [
        customer.name,
        customer.phone,
        customer.email,
        customer.total_orders,
        customer.total_spent,
        customer.avg_order_value,
        customer.first_order_date,
        customer.last_order_date,
        customer.customer_type,
        customer.success_rate
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="customer-report-${period}.csv"`)
      return res.send(csvContent)
    }

    logger.info(`Customer report generated: ${formattedCustomers.length} customers`)
    res.json(successResponse(report))
  } catch (error) {
    logger.error('Generate customer report error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

/**
 * Generate financial report
 */
export async function generateFinancialReport(req, res) {
  try {
    const { format = 'json', period = '30d' } = req.query
    
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

    // Get financial data
    const [orderStats, paymentStats, dailyRevenue] = await Promise.all([
      // Order financial summary
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total: true, subtotal: true, tax: true },
        _avg: { total: true },
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: 'CANCELLED' }
        }
      }),
      
      // Payment breakdown
      prisma.payment.groupBy({
        by: ['method', 'status'],
        _count: { method: true },
        _sum: { amount: true },
        where: {
          createdAt: { gte: dateFrom, lte: dateTo }
        }
      }),
      
      // Daily revenue breakdown
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders_count,
          SUM(total) as revenue,
          SUM(subtotal) as subtotal,
          SUM(tax) as tax
        FROM orders 
        WHERE created_at >= ${dateFrom} AND created_at <= ${dateTo} AND status != 'CANCELLED'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ])

    // Calculate payment method breakdown
    const paymentMethodStats = paymentStats.reduce((acc, stat) => {
      const key = stat.method
      if (!acc[key]) {
        acc[key] = { total_count: 0, total_amount: 0, by_status: {} }
      }
      acc[key].total_count += stat._count.method
      acc[key].total_amount += parseFloat(stat._sum.amount || 0)
      acc[key].by_status[stat.status] = {
        count: stat._count.method,
        amount: parseFloat(stat._sum.amount || 0)
      }
      return acc
    }, {})

    // Format daily revenue
    const formattedDailyRevenue = dailyRevenue.map(day => ({
      date: day.date,
      orders_count: parseInt(day.orders_count),
      revenue: parseFloat(day.revenue),
      subtotal: parseFloat(day.subtotal),
      tax: parseFloat(day.tax),
      avg_order_value: parseInt(day.orders_count) > 0 
        ? parseFloat(day.revenue) / parseInt(day.orders_count) 
        : 0
    }))

    const summary = {
      period_revenue: parseFloat(orderStats._sum.total || 0),
      period_subtotal: parseFloat(orderStats._sum.subtotal || 0),
      period_tax: parseFloat(orderStats._sum.tax || 0),
      total_orders: orderStats._count.id || 0,
      average_order_value: parseFloat(orderStats._avg.total || 0),
      tax_rate: parseFloat(orderStats._sum.subtotal || 0) > 0 
        ? (parseFloat(orderStats._sum.tax || 0) / parseFloat(orderStats._sum.subtotal || 0)) * 100 
        : 0,
      daily_average_revenue: formattedDailyRevenue.length > 0 
        ? formattedDailyRevenue.reduce((sum, day) => sum + day.revenue, 0) / formattedDailyRevenue.length 
        : 0,
      payment_collection_rate: 0 // TODO: Calculate based on verified payments
    }

    const report = {
      report_type: 'financial',
      generated_at: new Date().toISOString(),
      period: {
        type: period,
        from: dateFrom.toISOString(),
        to: dateTo.toISOString()
      },
      summary,
      payment_methods: paymentMethodStats,
      daily_breakdown: formattedDailyRevenue,
      trends: {
        revenue_trend: formattedDailyRevenue.length > 1 
          ? ((formattedDailyRevenue[0].revenue - formattedDailyRevenue[formattedDailyRevenue.length - 1].revenue) / formattedDailyRevenue[formattedDailyRevenue.length - 1].revenue) * 100 
          : 0,
        order_trend: formattedDailyRevenue.length > 1 
          ? ((formattedDailyRevenue[0].orders_count - formattedDailyRevenue[formattedDailyRevenue.length - 1].orders_count) / formattedDailyRevenue[formattedDailyRevenue.length - 1].orders_count) * 100 
          : 0
      },
      metadata: {
        currency: 'PEN',
        tax_rate_percent: summary.tax_rate,
        period,
        format
      }
    }

    if (format === 'csv') {
      const csvHeaders = [
        'Date', 'Orders Count', 'Revenue', 'Subtotal', 'Tax', 'Avg Order Value'
      ]
      
      const csvRows = formattedDailyRevenue.map(day => [
        day.date,
        day.orders_count,
        day.revenue,
        day.subtotal,
        day.tax,
        day.avg_order_value
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${period}.csv"`)
      return res.send(csvContent)
    }

    logger.info(`Financial report generated for period: ${period}`)
    res.json(successResponse(report))
  } catch (error) {
    logger.error('Generate financial report error:', error)
    res.status(500).json(commonErrors.internalError())
  }
}

export default {
  generateSalesReport,
  generateInventoryReport,
  generateCustomerReport,
  generateFinancialReport
}