// Machine-to-machine routes (no user login). Each checks its own secret.
const express = require("express");
const { supabaseWebhook, cronSync } = require("../controllers/syncController");

const router = express.Router();

router.post("/supabase/webhook", supabaseWebhook);
router.get("/cron", cronSync);

module.exports = router;
