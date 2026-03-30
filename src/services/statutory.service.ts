import StatutoryConfig, { IStatutoryConfig } from '../models/StatutoryConfig';
import { logAuditManual } from '../middleware/auditLogger';

export class StatutoryService {
    static async getConfig(organizationId: string): Promise<IStatutoryConfig | null> {
        return await StatutoryConfig.findOne({ organizationId });
    }

    static async updateConfig(organizationId: string, data: Partial<IStatutoryConfig>, actorId: string, actorRole: string): Promise<IStatutoryConfig> {
        let config = await StatutoryConfig.findOne({ organizationId });
        const oldValues = config ? config.toObject() : null;

        if (!config) {
            config = new StatutoryConfig({ ...data, organizationId });
        } else {
            Object.assign(config, data);
        }

        await config.save();

        await logAuditManual({
            actorId,
            actorRole,
            organizationId,
            action: oldValues ? 'update' : 'create',
            module: 'StatutoryConfig',
            targetId: config._id.toString(),
            targetModel: 'StatutoryConfig',
            previousValue: oldValues,
            newValue: config.toObject()
        });

        return config;
    }
}
