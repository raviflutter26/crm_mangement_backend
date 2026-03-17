const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['Attendance', 'Leave', 'Permission', 'Payroll', 'Recruitment', 'Expense', 'Profile', 'System'], default: 'System' },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: null }, // URL or Route link
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
