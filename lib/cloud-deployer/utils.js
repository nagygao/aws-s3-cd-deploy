import fs from 'fs'
import path from 'path'

export const consoleGreen = '\x1b[32m%s\x1b[0m';
export const consoleRed = '\x1b[31m%s\x1b[0m';
export const consoleYellow = '\x1b[33m%s\x1b[0m';
export const consoleBlue = '\x1b[34m%s\x1b[0m';


export function ensureConfig(configInt) {
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
}

// Helper for a small delay
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function* walk(dir) {
    for await (const d of await fs.promises.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* await walk(entry);
        else if (d.isFile()) yield entry;
    }
  }