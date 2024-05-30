import { S3Client } from '@aws-sdk/client-s3'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'

import { fromIni } from '@aws-sdk/credential-provider-ini'

export class AWSClient {
  constructor (configInt) {
    const credentials =
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : fromIni({ profile: configInt.awsProfile }) || null

    if (credentials) {
      this.s3Client = new S3Client({ credentials, region: configInt.s3Region })
    } else {
      this.s3Client = new S3Client({ region: configInt.s3Region })
    }

    this.cfClient = new CloudFrontClient({ region: configInt.s3Region })
  }
  get getS3Client() {
    return this.s3Client
  }

  get getCfClient() {
    return this.cfClient
  }

  set setS3Client(client) {
    this.s3Client = client
  }

  set setCfClient(client) {
    this.cfClient = client
  }
}
