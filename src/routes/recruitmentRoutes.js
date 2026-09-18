const express = require('express');
const router = express.Router();
const { authenticate: auth, authorize, selfService } = require('../middleware/auth');
const ctrl = require('../controllers/recruitmentController');

// Job Postings
router.get('/job-postings', auth, selfService('internal openings are visible to every employee'), ctrl.getJobPostings);
router.post('/job-postings', auth, authorize('Admin', 'HR'), ctrl.createJobPosting);
router.put('/job-postings/:id', auth, authorize('Admin', 'HR'), ctrl.updateJobPosting);
router.delete('/job-postings/:id', auth, authorize('Admin', 'HR'), ctrl.deleteJobPosting);

// Candidates
router.get('/candidates', auth, authorize('Admin', 'HR', 'Manager'), ctrl.getCandidates);
router.post('/candidates', auth, selfService('anyone may refer or apply on a candidate\'s behalf'), ctrl.createCandidate);
router.put('/candidates/:id', auth, authorize('Admin', 'HR'), ctrl.updateCandidate);
router.delete('/candidates/:id', auth, authorize('Admin', 'HR'), ctrl.deleteCandidate);
router.patch('/candidates/:id/status', auth, authorize('Admin', 'HR'), ctrl.updateCandidateStatus);

module.exports = router;
