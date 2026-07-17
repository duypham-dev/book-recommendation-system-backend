import express from 'express';
import {
    getWebhookDoc,
    updateWebhookDoc,
    triggerManualWebhook
} from '#controllers/user/webhook-doc.controller.js';

const router = express.Router();

router.get('/webhook-doc', getWebhookDoc);
router.post('/webhook-doc', updateWebhookDoc);
router.post('/webhook-doc/trigger', triggerManualWebhook);

export { router as webhookDocRouter };
