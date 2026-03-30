import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
    name: string;
    code: string;
    organizationId: mongoose.Types.ObjectId;
    managerId?: mongoose.Types.ObjectId;
    parentDepartmentId?: mongoose.Types.ObjectId;
    description?: string;
    status: 'active' | 'inactive';
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

const DepartmentSchema: Schema = new Schema({
    name: { type: String, required: true },
    code: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    parentDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique department names within the same organization
DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
