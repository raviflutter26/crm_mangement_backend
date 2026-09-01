const mongoose = require('mongoose');

// Stores SSO *configuration* only — there is no working OAuth/SAML handshake
// wired up. `connected` always reflects whether real credentials + a completed
// provider-side handshake exist, which this app cannot establish on its own.
const ssoConfigSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    provider: { type: String, enum: ['none', 'google', 'okta', 'azure', 'saml'], default: 'none' },
    enabled: { type: Boolean, default: false },
    clientId: { type: String, trim: true },
    domain: { type: String, trim: true },
    metadataUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SsoConfig', ssoConfigSchema);
