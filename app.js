const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const yargs = require('yargs');
const { S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { fromIni } = require('@aws-sdk/credential-provider-ini'); 
const { exit } = require('process');
const utils = require('./utils')

// Set console colors
const consoleGreen = '\x1b[32m%s\x1b[0m';
const consoleRed = '\x1b[31m%s\x1b[0m';
const consoleYellow = '\x1b[33m%s\x1b[0m';
const consoleBlue = '\x1b[34m%s\x1b[0m';

// Get config file from argument
const argv = yargs.options('config', {
  alias: 'c',
  describe: 'Path to the configuration file.',
}).argv;

// Handling missing config file location
if (process.env.AWS_DEPLOY_CONFIG_FILE == "" || argv.config == "") {
  console.error(consoleRed, 'Configuration is missing! Please set AWS_DEPLOY_CONFIG_FILE or use --config option.');
  exit(1);
}

// Configuration loading
const configPath = process.env.AWS_DEPLOY_CONFIG_FILE || argv.config;
const configData = fs.readFileSync(path.resolve(configPath), 'utf-8');
const config = JSON.parse(configData);

// Set variables from config or environment variables
const configInt = {
  awsProfile: config.awsProfile || process.env.AWS_PROFILE,
  bucketName: process.env.AWS_DEPLOY_BUCKET_NAME || config.bucketName,
  s3Region: process.env.AWS_DEPLOY_BUCKET_REGION || config.bucketRegion,
  webFolder: process.env.AWS_DEPLOY_WEB_FOLDER ||  config.webFolder,
  cloudFrontDistributionId: process.env.AWS_DEPLOY_CLOUDFRONT_ID || config.cloudFrontID,
  cloudFrontDefaultCacheRule: config.cloudFrontDefaultCacheRule || "no-cache",
  cloudFrontInvalidationPaths: config.cloudFrontInvalidationPaths || [ "/*" ],
  cloudFrontCacheRules: config.cloudFrontCacheRules,
  emptyBucket: process.env.AWS_DEPLOY_EMPTY_BUCKET || config.emptyBucket || false,
}

utils.ensureConfig(configInt)

// Credentials handling
const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
    : fromIni({ profile: configInt.awsProfile }) || null;

// Handling missing credentials
if (!credentials) {
  console.error(consoleRed, `Credentials not found, please double check your config`);
  process.exit(1);
}

// Handling missing web folder.
if (!fs.existsSync(configInt.webFolder)) {
  console.error(consoleRed, `WebFolder cannot be found. Please double check your config`);
  process.exit(1);
}

// Create AWS clients
const s3Client = new S3Client({ credentials, region: configInt.s3Region });
const cfClient = new CloudFrontClient({ region: configInt.s3Region }); 

// Function for recursive upload
async function uploadDirectory(directoryPath, s3PathPrefix = '') {
  const files = fs.readdirSync(directoryPath);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isDirectory()) {
      await uploadDirectory(filePath, s3PathPrefix + file + '/');
    } else {
      const key = s3PathPrefix + file;
      const contentType = mime.lookup(filePath) || 'application/octet-stream'; 

      for (const cacheRule of configInt.cloudFrontCacheRules) {
        let escapedPath = cacheRule.path.replace(/\./g, '\\.').replace(/\*/g, '.*'); 
        let pattern = escapedPath;
        if (escapedPath.startsWith('/')) {
          pattern = '^' + escapedPath.substring(1);
      }
      if (key.match(new RegExp(pattern))) { 
          cacheControl = cacheRule.cacheControl;
          console.log('\x1b[36m%s\x1b[0m', `Cache rule for ${key}: ${cacheControl}`);
          break;
        }
      }

      const uploadParams = {
        Bucket: configInt.bucketName,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: cacheControl || configInt.cloudFrontDefaultCacherule,
      };

      try {
        await s3Client.send(new PutObjectCommand(uploadParams)); 
        console.log(`Uploaded: ${key}`);
      } catch (error) {
        console.error(consoleRed, `Error uploading ${key}:`, error);
      }
    }
  }
}

// Function for empty bucket
async function emptyBucket() {
  const listParams = {
    Bucket: configInt.bucketName
  };

  try {
    const data = await s3Client.send(new ListObjectsCommand(listParams));
    console.log(consoleYellow, 'Emptying bucket...');
    
    if (data.Contents && data.Contents.length > 0) {
      console.log(consoleBlue, data.Contents.length + ' items found in bucket ' + configInt.bucketName)
      const deleteParams = {
        Bucket: configInt.bucketName,
        Delete: { Objects: [] }
      };

      data.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
      });

      await s3Client.send(new DeleteObjectsCommand(deleteParams));  
    } 
  } catch (error) {
    console.error(consoleRed, 'Error emptying bucket: ', error);
    exit(1);
  }
  
  console.log(consoleGreen, 'Bucket emptied successfully!')
}

async function waitForCloudFrontInvalidation(cfClient, distributionId, invalidationId) {
  const getInvalidationParams = {
    DistributionId: distributionId,
    Id: invalidationId
  };

  let invalidationStatus;
  do {
    await utils.delay(5000);

    const { Invalidation } = await cfClient.send(new GetInvalidationCommand(getInvalidationParams));
    invalidationStatus = Invalidation.Status;

  } while (invalidationStatus !== 'Completed');
}

async function main() {
  const directoryToUpload = config.buildFolder || process.env.AWS_DEPLOY_WEB_FOLDER;

  if (configInt.emptyBucket) {
    await emptyBucket();
    await utils.delay(500);
  }

  await uploadDirectory(configInt.webFolder);

  // Create CloudFront Invalidation
  const invalidationParams = {
    DistributionId: configInt.cloudFrontDistributionId, 
    InvalidationBatch: {
      Paths: {
        Quantity: 1, 
        Items: configInt.cloudFrontInvalidationPaths
      },
      CallerReference: Date.now().toString()
    }
  };

  try {
    const createResult = await cfClient.send(new CreateInvalidationCommand(invalidationParams));
    console.log(consoleYellow, `CloudFront invalidation created:`, createResult.Invalidation.Id); // Yellow color

    await waitForCloudFrontInvalidation(cfClient, configInt.cloudFrontDistributionId, createResult.Invalidation.Id); 
    console.log(consoleGreen, 'CloudFront invalidation completed successfully!'); // Green color
  } catch (error) {
    console.error(consoleRed, 'CloudFront invalidation error:', error);
  }
}

main().catch((err) => console.error(err)); 