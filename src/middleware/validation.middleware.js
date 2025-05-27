export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation',
          message: 'Datos inválidos',
          details: error.errors
        }
      });
    }
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation',
          message: 'Parámetros inválidos',
          details: error.errors
        }
      });
    }
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation',
          message: 'Query inválida',
          details: error.errors
        }
      });
    }
  };
};