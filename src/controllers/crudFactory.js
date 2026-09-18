/**
 * Generic CRUD Controller Factory
 * Creates standard getAll, getById, create, update, delete handlers for any Mongoose model.
 */
const { scopeFilter, withOrg } = require('../utils/tenancy');

const createCrudController = (Model, modelName, populateFields = '') => {
    // Scoping comes from src/utils/tenancy.js rather than a local copy. The copy
    // that used to live here returned { organizationId: undefined } for a user
    // with no organization, and an undefined value is dropped by the driver —
    // which turned the filter into a match-all across every tenant. The shared
    // helper fails closed instead.
    return {
        getAll: async (req, res) => {
            try {
                const filter = { ...scopeFilter(req) };
                if (req.query.status) filter.status = req.query.status;
                if (req.query.employee) filter.employee = req.query.employee;

                let query = Model.find(filter).sort({ createdAt: -1 });
                if (populateFields) {
                    populateFields.split(' ').forEach(field => {
                        query = query.populate(field);
                    });
                }
                const data = await query;
                res.json({ success: true, data, count: data.length });
            } catch (err) {
                console.error(`${modelName} getAll error:`, err);
                res.status(500).json({ success: false, message: err.message });
            }
        },

        getById: async (req, res) => {
            try {
                let query = Model.findOne({ _id: req.params.id, ...scopeFilter(req) });
                if (populateFields) {
                    populateFields.split(' ').forEach(field => {
                        query = query.populate(field);
                    });
                }
                const item = await query;
                if (!item) return res.status(404).json({ success: false, message: `${modelName} not found` });
                res.json({ success: true, data: item });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        },

        create: async (req, res) => {
            try {
                // Organization always comes from the authenticated user, never the
                // client payload; withOrg strips any supplied key before stamping.
                const item = await Model.create(withOrg(req, req.body));
                res.status(201).json({ success: true, data: item, message: `${modelName} created successfully` });
            } catch (err) {
                console.error(`${modelName} create error:`, err);
                res.status(400).json({ success: false, message: err.message });
            }
        },

        update: async (req, res) => {
            try {
                const { organizationId, ...updates } = req.body;
                const item = await Model.findOneAndUpdate({ _id: req.params.id, ...scopeFilter(req) }, updates, { new: true, runValidators: true });
                if (!item) return res.status(404).json({ success: false, message: `${modelName} not found` });
                res.json({ success: true, data: item, message: `${modelName} updated successfully` });
            } catch (err) {
                res.status(400).json({ success: false, message: err.message });
            }
        },

        delete: async (req, res) => {
            try {
                const item = await Model.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
                if (!item) return res.status(404).json({ success: false, message: `${modelName} not found` });
                res.json({ success: true, message: `${modelName} deleted successfully` });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        },

        // Employee-scoped: get records for the logged-in user's employee profile
        getMyRecords: async (req, res) => {
            try {
                // Self-scoped, and still tenant-scoped underneath: the caller's own
                // organization, never the organizationId they sent up.
                const filter = { ...scopeFilter(req) };
                // Match by employee field or reportedBy field
                if (req.user && req.user._id) {
                    filter.$or = [
                        { employee: req.user._id },
                        { reportedBy: req.user._id }
                    ];
                }

                let query = Model.find(filter).sort({ createdAt: -1 });
                if (populateFields) {
                    populateFields.split(' ').forEach(field => {
                        query = query.populate(field);
                    });
                }
                const data = await query;
                res.json({ success: true, data, count: data.length });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        }
    };
};

module.exports = createCrudController;
