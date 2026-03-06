const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/recruitmentController');

// Job Postings
router.get('/job-postings', auth, ctrl.getJobPostings);
router.post('/job-postings', auth, ctrl.createJobPosting);
router.put('/job-postings/:id', auth, ctrl.updateJobPosting);
router.delete('/job-postings/:id', auth, ctrl.deleteJobPosting);

// Candidates
router.get('/candidates', auth, ctrl.getCandidates);
router.post('/candidates', auth, ctrl.createCandidate);
router.put('/candidates/:id', auth, ctrl.updateCandidate);
router.delete('/candidates/:id', auth, ctrl.deleteCandidate);
router.patch('/candidates/:id/status', auth, ctrl.updateCandidateStatus);

module.exports = router;
