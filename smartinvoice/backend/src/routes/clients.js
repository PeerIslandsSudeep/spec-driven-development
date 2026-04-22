const express = require("express");
const { createClient, listClients, getClient } = require("../services/clientService");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try { res.json(await listClients()); } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const doc = await createClient(req.body);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try { res.json(await getClient(req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
