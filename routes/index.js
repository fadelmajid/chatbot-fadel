const express = require('express');
const router = express.Router();
const Controller = require('../controllers');

router.post('/webhook/', Controller.callback);
router.get('/', Controller.healthCheck);
router.get('/webhook/', Controller.facebookVerification);
router.get('/messages/', Controller.getAllMessages);
router.get('/messages/:message_id', Controller.getMessage);
router.delete('/messages/:message_id', Controller.deleteMessage);

module.exports = router;