/**
 * One-off backfill: creates realistic sample Projects for the two sample orgs seeded by
 * seedSampleOrgHierarchy.js, so the Project Management page has real data to show.
 *
 * Usage:
 *   node src/backfillProjects.js            # dry run (default) - no writes
 *   node src/backfillProjects.js --commit    # actually writes
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Project = require('./models/Project');
const User = require('./models/User');

const COMMIT = process.argv.includes('--commit');

const PROJECT_TEMPLATES = {
    'cauverytech.test': [
        { name: '5MW Solar Rooftop - Coimbatore Textile Park', client: 'Kovai Textiles Ltd', site: 'Coimbatore Industrial Estate', status: 'In Progress', progress: 65, budget: 32000000, months: [-4, 3] },
        { name: '2MW Ground-Mount Solar Farm - Pollachi', client: 'Pollachi AgroTech', site: 'Pollachi, Coimbatore Dt.', status: 'In Progress', progress: 40, budget: 14500000, months: [-2, 5] },
        { name: 'Rooftop Solar - Cauvery Corporate HQ', client: 'Internal (Cauvery Technologies)', site: 'Coimbatore HQ', status: 'Completed', progress: 100, budget: 6800000, months: [-10, -1] },
        { name: 'Solar + Battery Hybrid - Tiruppur Knitwear Unit', client: 'Tiruppur Knit Exports', site: 'Tiruppur', status: 'Planning', progress: 5, budget: 21000000, months: [1, 8] },
        { name: 'O&M Contract Renewal - Erode Substation', client: 'Erode Power Distribution Co.', site: 'Erode', status: 'On Hold', progress: 20, budget: 4200000, months: [-3, 2] },
    ],
    'nilgirisindustries.test': [
        { name: '3MW Solar Farm - Udhagamandalam Tea Estate', client: 'Nilgiris Tea Estates Pvt Ltd', site: 'Udhagamandalam', status: 'In Progress', progress: 55, budget: 19500000, months: [-3, 4] },
        { name: 'Rooftop Solar - Coonoor Cold Storage Facility', client: 'Coonoor Cold Chain Ltd', site: 'Coonoor', status: 'In Progress', progress: 30, budget: 9800000, months: [-1, 6] },
        { name: 'Micro-Grid Solar - Kotagiri Hill Villages', client: 'Nilgiris District Rural Dev. Board', site: 'Kotagiri', status: 'Completed', progress: 100, budget: 5200000, months: [-9, -2] },
        { name: '1.5MW Solar Carport - Ooty Bus Terminus', client: 'Nilgiris Transport Corporation', site: 'Ooty', status: 'Planning', progress: 0, budget: 8700000, months: [2, 9] },
        { name: 'Annual O&M - Gudalur Estate Installations', client: 'Gudalur Plantations Ltd', site: 'Gudalur', status: 'On Hold', progress: 15, budget: 3100000, months: [-4, 1] },
    ],
};

function addMonths(base, n) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + n);
    return d;
}

async function main() {
    console.log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const now = new Date();

    for (const [domain, templates] of Object.entries(PROJECT_TEMPLATES)) {
        const org = await User.findOne({ email: new RegExp(`@${domain}$`), role: 'admin' });
        if (!org) { console.log(`SKIP domain ${domain} — no admin user found`); continue; }
        const orgId = org.organizationId;

        const managers = await User.find({ organizationId: orgId, role: 'manager' });
        console.log(`\nOrg ${orgId} (${domain}) — ${managers.length} manager(s) available:`);

        let i = 0;
        for (const tpl of templates) {
            const existing = await Project.findOne({ organizationId: orgId, name: tpl.name });
            if (existing) {
                console.log(`  SKIP  ${tpl.name} (already exists)`);
                i++;
                continue;
            }

            const manager = managers.length ? managers[i % managers.length] : null;
            const startDate = addMonths(now, tpl.months[0]);
            const endDate = addMonths(now, tpl.months[1]);

            console.log(`  CREATE ${tpl.name} [${tpl.status}, ${tpl.progress}%]${manager ? ` — manager: ${manager.firstName} ${manager.lastName}` : ''}`);

            if (COMMIT) {
                await Project.create({
                    name: tpl.name,
                    client: tpl.client,
                    description: `${tpl.status === 'Completed' ? 'Completed' : 'Ongoing'} solar installation engagement for ${tpl.client}, site: ${tpl.site}.`,
                    status: tpl.status,
                    progress: tpl.progress,
                    startDate,
                    endDate,
                    budget: tpl.budget,
                    manager: manager ? manager._id : null,
                    site: tpl.site,
                    organizationId: orgId,
                    isActive: true,
                });
            }
            i++;
        }
    }

    console.log(`\n${COMMIT ? 'Committed' : 'Would commit'} project backfill.`);
    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
