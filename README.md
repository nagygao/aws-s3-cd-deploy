# Deploy static websites to S3 bucket

Deploy static websites to S3, set caching rules and invalidate CloudFront Distribution.  
You can use this tool for upload files to an S3 folder with the right mime types based on the extension of the file.  
The CloudFront Distribution cache will be invalidated after the upload.  
Also you can set caching rules for individual files or folders.  
Caching rules are read from top to bottom. The first hit will be applied.  
E.g. you want to cache just `example.css` file in the `css` folder you need to set first the caching role for example.css and then set no-cache for the `css` folder.  

Create a config JSON file for configuration.  

Example config:

```json
{
    "awsProfile": "",
    "bucketName": "my-website",
    "emptyBucket": true,
    "bucketRegion": "eu-central-1",
    "webFolder": "build/website/",
    "cloudFrontID": "1234567890ABCD",
    "cloudFrontDefaultCacheControl": "no-cache",
    "cloudFrontInvalidationPaths": [
        "/*"
    ],
    "cloudFrontCacheRules": [{
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
    },
    {
        "path": "*.js",
        "cacheControl": "max-age=2592000"
    },
    {
        "path": "css/*.scss",
        "cacheControl": "no-cache"
    }]
}
```

Also you can use the following env variables

```
AWS_ACCESS_KEY_ID - Your AWS access key ID.
AWS_SECRET_ACCESS_KEY - Your AWS access key secret.
AWS_PROFILE - Your AWS profile.
AWS_DEPLOY_CONFIG_FILE - String: Path to the configuration file.
AWS_DEPLOY_BUCKET_NAME - String: The name of the bucket where you want to upload the static site files.
AWS_DEPLOY_BUCKET_REGION - String: The AWS region of the S3 bucket. (e.g.: us-east-1)
AWS_DEPLOY_WEB_FOLDER - String: Path to static site's folder
AWS_DEPLOY_EMPTY_BUCKET - Bool: Empty the S3 bucket before upload.
AWS_DEPLOY_CLOUDFRONT_ID - String: The ID of the CloudFront Distribution.
AWS_DEPLOY_CLOUDFRONT_INVALIDATION_PATHS - Array: The paths for the cloudfront invalidation
```

Default values:
```
cloudFrontDefaultCacheControl - "no-cache"
cloudFrontInvalidationPaths - [ "/*" ]
```

`config.cloudFrontCacheRules` if the only value which has to be set in configuration file.