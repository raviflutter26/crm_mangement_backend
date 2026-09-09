/**
 * The endpoints the sweep visits, and who is expected to reach them.
 *
 * Deliberately an explicit list rather than router introspection: Express 5
 * changed the internal layer shape, so a clever walker breaks on upgrade. The
 * drift check in checkDrift() flags any mount in routes/index.js that is absent
 * here, which keeps the list honest without depending on internals.
 *
 * `expect` records the status a role SHOULD get. Where it is omitted the sweep
 * still reports what happened but does not call it a failure — useful for
 * endpoints whose intended access rules have never been written down.
 *
 *   200 = should succeed
 *   403 = should be refused
 */

const ALL = ['superadmin', 'admin', 'hr', 'manager', 'employee'];
const TENANT = ['admin', 'hr', 'manager', 'employee'];

/** Every role may read it. */
const open = (path, label) => ({ path, label, expect: Object.fromEntries(ALL.map((r) => [r, 200])) });

/** Readable by the listed roles; everyone else must be refused. */
const only = (path, label, allowed) => ({
    path,
    label,
    expect: Object.fromEntries(ALL.map((r) => [r, allowed.includes(r) ? 200 : 403])),
});

/**
 * Like only(), but says nothing about superadmin.
 *
 * Endpoints that resolve their tenant from req.user.organizationId cannot be
 * judged for a platform superadmin: it belongs to no organization, so it
 * neither succeeds nor is refused — it 400s on the missing org. Asserting
 * either outcome would encode a permanent, unfixable failure.
 */
const orgScoped = (path, label, allowed) => ({
    path,
    label,
    expect: Object.fromEntries(
        TENANT.map((r) => [r, allowed.includes(r) ? 200 : 403])
    ),
});

/** Reported but not judged — access rules not yet specified. */
const observe = (path, label) => ({ path, label, expect: {} });

const ENDPOINTS = [
    // --- identity -------------------------------------------------------
    open('/api/auth/me', 'Current user'),
    open('/api/auth/sessions', 'Own sessions'),
    // Organization-scoped: the controller reads req.user.organizationId. A
    // platform superadmin owns no organization, so it clears authorize() but
    // then gets 400 — neither success nor refusal. Left unjudged for that role
    // rather than asserting an outcome the data model rules out.
    orgScoped('/api/auth/sso-config', 'SSO config', ['admin']),
    only('/api/auth/users', 'User list', ['superadmin', 'admin']),

    // --- core tenant data ------------------------------------------------
    observe('/api/dashboard', 'Dashboard'),
    observe('/api/dashboard/analytics', 'Analytics'),
    observe('/api/employees', 'Employees'),
    observe('/api/departments', 'Departments'),
    observe('/api/organizations', 'Organizations'),
    observe('/api/locations', 'Locations'),
    observe('/api/shifts', 'Shifts'),

    // --- attendance & leave ----------------------------------------------
    observe('/api/attendance', 'Attendance'),
    observe('/api/attendance-config', 'Attendance settings'),
    observe('/api/leaves', 'Leaves'),
    observe('/api/admin/config/leave-policy', 'Leave policy'),
    observe('/api/timesheets', 'Timesheets'),

    // --- payroll ---------------------------------------------------------
    observe('/api/payroll', 'Payroll records'),
    observe('/api/payroll/summary', 'Payroll summary'),
    observe('/api/payroll/reports', 'Payroll reports'),
    observe('/api/payroll/audit-logs', 'Payroll audit log'),
    observe('/api/payroll-runs', 'Payroll runs'),
    observe('/api/salary-components', 'Salary components'),
    observe('/api/salary-structures', 'Salary structures'),
    observe('/api/salary-templates', 'Salary templates'),
    observe('/api/compliance', 'Compliance'),
    observe('/api/statutory/config', 'Statutory config'),
    only('/api/payouts/status', 'Payout status', ['superadmin', 'admin', 'hr']),
    only('/api/payouts/history', 'Payout history', ['superadmin', 'admin', 'hr']),

    // --- revenue (new module) --------------------------------------------
    only('/api/revenue/summary', 'Revenue summary', ['superadmin', 'admin', 'manager']),
    only('/api/revenue/by-project', 'Revenue by project', ['superadmin', 'admin', 'manager']),
    only('/api/revenue/invoices', 'Invoices', ['superadmin', 'admin', 'manager']),

    // --- operations ------------------------------------------------------
    observe('/api/projects', 'Projects'),
    observe('/api/vendors', 'Vendors'),
    observe('/api/job-cards', 'Job cards'),
    observe('/api/travel-requests', 'Travel requests'),
    observe('/api/incidents', 'Incidents'),
    observe('/api/ppe-records', 'PPE records'),
    observe('/api/reimbursements', 'Reimbursements'),
    observe('/api/site-allowances', 'Site allowances'),
    observe('/api/expenses', 'Expenses'),
    observe('/api/assets', 'Assets'),

    // --- people ----------------------------------------------------------
    observe('/api/trainings', 'Trainings'),
    observe('/api/certifications', 'Certifications'),
    observe('/api/skills', 'Skills'),
    observe('/api/announcements', 'Announcements'),
    observe('/api/employee-documents', 'Employee documents'),
    observe('/api/tax-documents', 'Tax documents'),
    observe('/api/recruitment/job-postings', 'Job postings'),
    observe('/api/recruitment/candidates', 'Candidates'),
    observe('/api/performance/goals', 'Goals'),
    observe('/api/performance/appraisals', 'Appraisals'),

    // --- access & admin --------------------------------------------------
    only('/api/permissions/my-permissions', 'My permissions', ['superadmin', 'employee']),
    observe('/api/role-permissions', 'Role permissions'),
    observe('/api/admin/config/permission', 'Permission policy'),
    observe('/api/ip-allowlist', 'IP allowlist'),
    observe('/api/invitations', 'Invitations'),
    observe('/api/support-tickets', 'Support tickets'),
    observe('/api/settings/attendance', 'Attendance settings (legacy path)'),
    observe('/api/master/industries', 'Master data — industries'),

    // --- platform (superadmin only) --------------------------------------
    only('/api/superadmin/analytics', 'Platform analytics', ['superadmin']),
    only('/api/superadmin/audit-log', 'Audit log', ['superadmin']),
    only('/api/superadmin/invitations', 'Platform invitations', ['superadmin']),
    only('/api/superadmin/locked-accounts', 'Locked accounts', ['superadmin']),
    only('/api/superadmin/sidebar-counts', 'Sidebar counts', ['superadmin']),
    only('/api/system/health', 'System health', ['superadmin']),
];

/**
 * Mounts declared in routes/index.js that no endpoint above covers.
 *
 * A module missing from the manifest is invisible to the sweep, which is the
 * one way this tool can quietly under-report. Surfacing the gap is cheaper
 * than trying to be exhaustive by hand.
 */
function checkDrift(routesIndexSource) {
    const mounted = [...routesIndexSource.matchAll(/router\.use\('(\/[^']+)'/g)].map((m) => m[1]);
    const covered = new Set(ENDPOINTS.map((e) => e.path.replace(/^\/api/, '')));

    return [...new Set(mounted)].filter((mount) => {
        for (const path of covered) {
            if (path === mount || path.startsWith(mount.endsWith('/') ? mount : `${mount}/`)) return false;
        }
        return true;
    });
}

module.exports = { ENDPOINTS, ALL_ROLES: ALL, TENANT_ROLES: TENANT, checkDrift };
