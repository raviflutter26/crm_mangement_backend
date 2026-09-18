const express = require('express');
const router = express.Router();
const { authenticate: auth, selfService } = require('../middleware/auth');
const ctrl = require('../controllers/supportController');

router.get('/', selfService('anyone may raise and track a support ticket'), auth, ctrl.getTickets);
router.post('/', selfService('anyone may raise and track a support ticket'), auth, ctrl.createTicket);
router.put('/:id', selfService('anyone may raise and track a support ticket'), auth, ctrl.updateTicket);
router.delete('/:id', selfService('anyone may raise and track a support ticket'), auth, ctrl.deleteTicket);
router.patch('/:id/status', selfService('anyone may raise and track a support ticket'), auth, ctrl.updateTicketStatus);

module.exports = router;
