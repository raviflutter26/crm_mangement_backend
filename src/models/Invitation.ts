import mongoose, { Schema, Document } from 'mongoose';

export interface IInvitation extends Document {
    email: string;
    role: string;
    organizationId: mongoose.Types.ObjectId;
    departmentId?: mongoose.Types.ObjectId;
    token: string;
    expiresAt: Date;
    status: 'pending' | 'accepted' | 'expired';
    invitedBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

const InvitationSchema: Schema = new Schema({
    email: { type: String, required: true, lowercase: true },
    role: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'expired'], 
        default: 'pending' 
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

InvitationSchema.index({ email: 1, organizationId: 1 });
InvitationSchema.index({ token: 1 });

export default mongoose.model<IInvitation>('Invitation', InvitationSchema);
