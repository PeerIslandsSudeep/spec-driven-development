const express = require("express");
const { computeInsights } = require("../services/insightsService");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try { res.json(await computeInsights()); }
  catch (e) { next(e); }
});

module.exports = router;
