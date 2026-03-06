const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    jobPosting: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
    resumeUrl: { type: String, trim: true },
    experience: { type: Number, default: 0 },
    currentCompany: { type: String, trim: true },
    currentCTC: { type: Number, default: 0 },
    expectedCTC: { type: Number, default: 0 },
    noticePeriod: { type: Number, default: 0 },
    status: { type: String, enum: ['applied', 'screening', 'interview', 'offered', 'hired', 'rejected'], default: 'applied' },
    interviewDate: { type: Date },
    interviewNotes: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    notes: { type: String, trim: true },
    source: { type: String, enum: ['portal', 'referral', 'linkedin', 'other'], default: 'portal' }
}, { timestamps: true });

module.exports = mongoose.model('Candidate', candidateSchema);
