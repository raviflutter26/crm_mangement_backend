import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
    actorId: mongoose.Types.ObjectId;
    actorRole: string;
    organizationId?: mongoose.Types.ObjectId;
    action: string;
    module: string;
    targetId: mongoose.Types.ObjectId;
    targetModel: string;
    previousValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}

const AuditLogSchema: Schema = new Schema({
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    action: { type: String, required: true }, // e.g., 'CREATE_EMPLOYEE'
    module: { type: String, required: true }, // e.g., 'employees'
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetModel: { type: String, required: true }, // e.g., 'User'
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now }
});

AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
