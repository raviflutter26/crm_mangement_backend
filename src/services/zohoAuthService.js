const axios = require('axios');
const config = require('../config');

class ZohoAuthService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get a valid access token, refreshing if needed
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        return await this.refreshAccessToken();
    }

    /**
     * Refresh the access token using refresh token
     */
    async refreshAccessToken() {
        try {
            const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
                params: {
                    refresh_token: config.zoho.refreshToken,
                    client_id: config.zoho.clientId,
                    client_secret: config.zoho.clientSecret,
                    grant_type: 'refresh_token',
                },
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000; // expire 60s early

            console.log('✅ Zoho access token refreshed successfully');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Failed to refresh Zoho access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Zoho');
        }
    }

    /**
     * Generate authorization URL for OAuth flow
     */
    getAuthorizationUrl() {
        const params = new URLSearchParams({
            scope: 'ZohoPeople.forms.ALL,ZohoPeople.attendance.ALL,ZohoPeople.leave.ALL,ZohoPayroll.employee.ALL,ZohoPayroll.payrun.ALL',
            client_id: config.zoho.clientId,
            response_type: 'code',
            access_type: 'offline',
            redirect_uri: config.zoho.redirectUri,
            prompt: 'consent',
        });
        return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(code) {
        try {
            const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
                params: {
                    code,
                    client_id: config.zoho.clientId,
                    client_secret: config.zoho.clientSecret,
                    redirect_uri: config.zoho.redirectUri,
                    grant_type: 'authorization_code',
                },
            });

            return response.data;
        } catch (error) {
            console.error('❌ Failed to exchange authorization code:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code');
        }
    }
}

module.exports = new ZohoAuthService();
