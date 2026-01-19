const PLANS = require("../config/plans");

module.exports = (feature) => (req, res, next) => {
  const plan = req.tenantPlan || "FREE";
  const allowed = PLANS[plan]?.[feature];

  if (!allowed) {
    return res.status(403).json({
      ok: false,
      error: `Función no disponible en plan ${plan}`,
    });
  }
  next();
};
