const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/supportController');

router.get('/', auth, ctrl.getTickets);
router.post('/', auth, ctrl.createTicket);
router.put('/:id', auth, ctrl.updateTicket);
router.delete('/:id', auth, ctrl.deleteTicket);
router.patch('/:id/status', auth, ctrl.updateTicketStatus);

module.exports = router;
