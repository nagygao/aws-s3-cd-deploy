import { S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { asyncParallelForEach, BACK_OFF_RETRY } from 'async-parallel-foreach'
import { lookup } from 'mime-types';
import { consoleGreen, walk } from './utils.js'
import fs from 'fs'


export async function uploadDirectory(s3Client, configInt, s3PathPrefix = '') {

    var files = []
    for await (const p of walk(configInt.webFolder))
      files.push(p)
  
    const parallelLimit = 5
    
    await asyncParallelForEach(files, parallelLimit, async (file, _) => {
      const key = s3PathPrefix + file;
      const contentType = lookup(file) || 'application/octet-stream'; 
  
      for (const cacheRule of configInt.cloudFrontCacheRules) {
        let escapedPath = cacheRule.path.replace(/\./g, '\\.').replace(/\*/g, '.*'); 
        let pattern = escapedPath;
        if (escapedPath.startsWith('/')) {
          pattern = '^' + escapedPath.substring(1);
        }
        if (key.match(new RegExp(pattern))) { 
          var cacheControl = cacheRule.cacheControl;
          console.log('\x1b[36m%s\x1b[0m', `Cache rule for ${key}: ${cacheControl}`);
          break;
        }
      }
      const uploadParams = {
        Bucket: configInt.bucketName,
        Key: key,
        Body: fs.createReadStream(file),
        ContentType: contentType,
        ACL: 'private',
        CacheControl: cacheControl || configInt.cloudFrontDefaultCacherule,
      };
      try {
        await s3Client.send(new PutObjectCommand(uploadParams)); 
        console.log(consoleGreen, `Uploaded: ${key}`); 
      } catch (error) {
        console.error(consoleRed, `Error uploading ${key}:`, error);
      }
    
    }, { 
      times: 5,  // try at most 10 times
      interval: BACK_OFF_RETRY.exponential()
    })
  }
  
// Function for empty bucket
export async function emptyBucket(s3Client, configInt) {
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