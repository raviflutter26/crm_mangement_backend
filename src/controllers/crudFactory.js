/**
 * Generic CRUD Controller Factory
 * Creates standard getAll, getById, create, update, delete handlers for any Mongoose model.
 */
const createCrudController = (Model, modelName, populateFields = '') => {
    // Non-superadmin requests are always scoped to the caller's own organization;
    // the organizationId is derived server-side from req.user, never trusted from the client.
    const scopeFilter = (req) => {
        const role = (req.user?.role || '').toLowerCase();
        if (role === 'superadmin') {
            return req.query.organizationId ? { organizationId: req.query.organizationId } : {};
        }
        return { organizationId: req.user?.organizationId };
    };

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
                const payload = { ...req.body };
                // Organization always comes from the authenticated user, never the client payload.
                if (req.user && req.user.organizationId) {
                    payload.organizationId = req.user.organizationId;
                }

                const item = await Model.create(payload);
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
                const filter = {};
                if (req.query.organizationId) filter.organizationId = req.query.organizationId;
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
