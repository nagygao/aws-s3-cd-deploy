// Ensure config

const consoleGreen = '\x1b[32m%s\x1b[0m';
const consoleRed = '\x1b[31m%s\x1b[0m';
const consoleYellow = '\x1b[33m%s\x1b[0m';
const consoleBlue = '\x1b[34m%s\x1b[0m';

module.exports.ensureConfig = function(configInt) {
    const requiredConfigs = [
        { key: 'bucketName', errorMessage: 'Bucket name' },
        { key: 's3Region', errorMessage: 'Bucket region' },
        { key: 'webFolder', errorMessage: 'Web folder' },
        { key: 'cloudFrontDistributionId', errorMessage: 'CloudFront distribution ID' },
        { key: 'cloudFrontCacheRules', errorMessage: 'CloudFront cache rules' },
    ];

    for (const config of requiredConfigs) {
        if (!configInt[config.key]) {
            console.error(consoleRed, `${config.errorMessage} not found in config or environment variable`);
            process.exit(1);
        }
    }

    const requiredEnvVariables = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

    for (const envVar of requiredEnvVariables) {
        if (!process.env[envVar]) {
            console.error(consoleRed, `Env variable ${envVar} not found.`);
            process.exit(1);
        }
    }
}

// Helper for a small delay
module.exports.delay = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }