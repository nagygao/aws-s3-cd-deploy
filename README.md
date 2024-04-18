# Deploy static websites to S3 bucket

Deploy static websites to S3, set caching rules and invalidate CloudFront Distribution.

Create a config JSON file for configuration

```json
{
    "awsProfile": "my-aws-profile",
    "bucketName": "my-website-bucket-name",
    "emptyBucket": false, 
    "bucketRegion": "bucket-aws-region",
    "buildFolder": "websit-static-files-folder",
    "cloudFrontID": "cloudfront-distribution-id",
    "cloudFrontInvalidationPaths": [
      "/*"
    ],
    "cloudFrontDefaultCacheControl": "no-cache",
    "cloudFrontCaches": [{ 
        "path": "index.html",
        "cacheControl": "no-cache"
    },
    {
        "path": "assets/*.jpg",
        "cacheControl": "max-age=604800"
    },
    {
        "path": "/assets/*",
        "cacheControl": "max-age=2592000"
    },
    {
        "path": "/favicon.ico",
        "cacheControl": "no-cache"
    }]
}
```

Also you can use the following env variables

```
AWS_ACCESS_KEY_ID - Your AWS access key ID.
AWS_SECRET_ACCESS_KEY - Your AWS access key secret.
AWS_PROFILE - Your AWS profile.
AWS_DEPLOY_CONFIG_FILE_ - String: Path to the configuration file.
AWS_DEPLOY_BUCKET_NAME - String: The name of the bucket where you want to upload the static site files.
AWS_DEPLOY_BUCKET_REGION - String: The AWS region of the S3 bucket. (e.g.: us-east-1)
AWS_DEPLOY_EMPTY_BUCKET - Bool: Empty the S3 bucket before upload.
AWS_DEPLOY_CLOUDFRONT_ID - String: The ID of the CloudFront Distribution.
AWS_DEPLOY_CLOUDFRONT_INVALIDATION_PATHS - Array: The paths for the cloudfront invalidation
AWS_DEPLOY_DEFAULT_CACHE_CONTROL - String: Default caching behavior for the uploaded files (if not set: no-cache)
```