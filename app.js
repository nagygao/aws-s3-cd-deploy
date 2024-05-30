import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import 'process'
import { ensureConfig, consoleRed } from './lib/cloud-deployer/utils.js'
import { uploadDirectory, emptyBucket } from './lib/cloud-deployer/s3.js'
import { invalidateCloudFront } from './lib/cloud-deployer/cloudfront.js'
import { AWSClient } from './lib/cloud-deployer/client.js'

// Get config file from argument
const argv = yargs(hideBin(process.argv)).options('config', {
  alias: 'c',
  describe: 'Path to the configuration file.'
}).argv

// Handling missing config file location
if (process.env.AWS_DEPLOY_CONFIG_FILE == '' || argv.config == '') {
  console.error(
    consoleRed,
    'Configuration is missing! Please set AWS_DEPLOY_CONFIG_FILE or use --config option.'
  )
  exit(1)
}

// Configuration loading
const configPath = process.env.AWS_DEPLOY_CONFIG_FILE || argv.config
const configData = fs.readFileSync(path.resolve(configPath), 'utf-8')
const config = JSON.parse(configData)

// Set variables from config or environment variables
const configInt = {
  awsProfile: config.awsProfile || process.env.AWS_PROFILE,
  bucketName: process.env.AWS_DEPLOY_BUCKET_NAME || config.bucketName,
  s3Region: process.env.AWS_DEPLOY_BUCKET_REGION || config.bucketRegion,
  webFolder: process.env.AWS_DEPLOY_WEB_FOLDER || config.webFolder,
  cloudFrontDistributionId:
    process.env.AWS_DEPLOY_CLOUDFRONT_ID || config.cloudFrontID,
  cloudFrontDefaultCacheRule: config.cloudFrontDefaultCacheRule || 'no-cache',
  cloudFrontInvalidationPaths: config.cloudFrontInvalidationPaths || ['/*'],
  cloudFrontCacheRules: config.cloudFrontCacheRules,
  emptyBucket:
    process.env.AWS_DEPLOY_EMPTY_BUCKET || config.emptyBucket || false
}

ensureConfig(configInt)

if (!fs.existsSync(configInt.webFolder)) {
  console.error(
    consoleRed,
    `WebFolder cannot be found. Please double check your config`
  )
  process.exit(1)
}

async function main () {
  var client = new AWSClient(configInt)
  if (configInt.emptyBucket) {
    await emptyBucket(client.s3Client, configInt)
    await utils.delay(500)
  }

  await uploadDirectory(client.s3Client, configInt)
  await invalidateCloudFront(client.cfClient, configInt)
}

main().catch(err => console.error(err))
