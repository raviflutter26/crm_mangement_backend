const express = require('express');
const router = express.Router();
const { authenticate: auth, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/recruitmentController');

// Job Postings
router.get('/job-postings', auth, ctrl.getJobPostings);
router.post('/job-postings', auth, authorize('Admin', 'HR'), ctrl.createJobPosting);
router.put('/job-postings/:id', auth, authorize('Admin', 'HR'), ctrl.updateJobPosting);
router.delete('/job-postings/:id', auth, authorize('Admin', 'HR'), ctrl.deleteJobPosting);

// Candidates
router.get('/candidates', auth, authorize('Admin', 'HR', 'Manager'), ctrl.getCandidates);
router.post('/candidates', auth, ctrl.createCandidate); // Candidates (or someone on their behalf) can apply
router.put('/candidates/:id', auth, authorize('Admin', 'HR'), ctrl.updateCandidate);
router.delete('/candidates/:id', auth, authorize('Admin', 'HR'), ctrl.deleteCandidate);
router.patch('/candidates/:id/status', auth, authorize('Admin', 'HR'), ctrl.updateCandidateStatus);

module.exports = router;
