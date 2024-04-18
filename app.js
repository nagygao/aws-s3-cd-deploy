const fs = require('fs');
const path = require('path');
const mime = require('mime-types'); 
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { fromIni } = require('@aws-sdk/credential-provider-ini'); 
const { exit } = require('process');

// Configuration loading
const config = JSON.parse(fs.readFileSync('./config.json'));
const bucketName = config.bucketName || process.env.AWS_DEPLOY_BUCKET_NAME;
const s3Region = config.bucketRegion || process.env.AWS_DEPLOY_BUCKET_REGION;
const cloudFrontDistributionId = config.cloudFrontID || process.env.AWS_DEPLOY_CLOUDFRONT_ID;

if (!cloudFrontDistributionId) {
  console.error('\x1b[31m%s\x1b[0m',  'CloudFront distribution ID not found in config or environment variable (cloudFrontID)');
  process.exit(1); 
}

// Credentials handling
const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
     }
    : fromIni({ profile: config.awsProfile || process.env.AWS_PROFILE }) || null;

const s3Client = new S3Client({ credentials, region: s3Region });
const cfClient = new CloudFrontClient({ region: s3Region }); 

// Helper function for recursive upload
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

      let cacheControl = config.cloudFrontDefaultCacheControl || process.env.AWS_DEPLOY_DEFAULT_CACHE_CONTROL; // Default cache control
      // console.log(`Checking cache rules for ${key}`);

      for (const cacheRule of config.cloudFrontCaches) {
        let escapedPath = cacheRule.path.replace(/\./g, '\\.').replace(/\*/g, '.*'); 
        let pattern = escapedPath;
        if (escapedPath.startsWith('/')) {
          pattern = '^' + escapedPath.substring(1); // Anchor to the start if leading '/'
      }
      if (key.match(new RegExp(pattern))) { 
          cacheControl = cacheRule.cacheControl;
          console.log('\x1b[36m%s\x1b[0m', `Cache rule for ${key}: ${cacheControl}`);
          break; // Match found, stop searching
        }
      }

      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: cacheControl || 'no-cache'
      };

      try {
        await s3Client.send(new PutObjectCommand(uploadParams)); 
        console.log(`Uploaded: ${key}`);
      } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error uploading ${key}:`, error);
      }
    }
  }
}

async function waitForCloudFrontInvalidation(cfClient, distributionId, invalidationId) {
  const getInvalidationParams = {
    DistributionId: distributionId,
    Id: invalidationId
  };

  let invalidationStatus;
  do {
    await delay(5000); // 5-second delay between checks

    const { Invalidation } = await cfClient.send(new GetInvalidationCommand(getInvalidationParams));
    invalidationStatus = Invalidation.Status;

  } while (invalidationStatus !== 'Completed');
}

// Helper for a small delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const directoryToUpload = config.buildFolder || process.env.AWS_DEPLOY_WEB_FOLDER;

  await uploadDirectory(directoryToUpload);

  // Create CloudFront Invalidation
  const invalidationParams = {
    DistributionId: cloudFrontDistributionId, 
    InvalidationBatch: {
      Paths: {
        Quantity: 1, 
        Items: config.cloudFrontInvalidationPaths // Invalidate all paths
      },
      CallerReference: Date.now().toString() // Unique reference
    }
  };

  try {
    const createResult = await cfClient.send(new CreateInvalidationCommand(invalidationParams));
    console.log('\x1b[33m%s\x1b[0m', `CloudFront invalidation created:`, createResult.Invalidation.Id); // Yellow color

    await waitForCloudFrontInvalidation(cfClient, cloudFrontDistributionId, createResult.Invalidation.Id); 
    console.log('\x1b[32m%s\x1b[0m', 'CloudFront invalidation completed successfully!'); // Green color
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'CloudFront invalidation error:', error);
  }
}

main().catch((err) => console.error(err)); 