const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    description: { type: String, trim: true },
    requirements: { type: String, trim: true },
    location: { type: String, trim: true },
    employmentType: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'], default: 'full-time' },
    experienceMin: { type: Number, default: 0 },
    experienceMax: { type: Number, default: 0 },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    openings: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'open', 'on-hold', 'closed'], default: 'draft' },
    postedBy: { type: String, trim: true },
    closingDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('JobPosting', jobPostingSchema);
