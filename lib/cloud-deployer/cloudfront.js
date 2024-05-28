import { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { consoleRed, consoleYellow, consoleGreen, delay } from './utils.js'


async function waitForCloudFrontInvalidation(cfClient, distributionId, invalidationId) {

    const getInvalidationParams = {
    DistributionId: distributionId,
    Id: invalidationId
  };

  let invalidationStatus;
  do {
    await delay(5000);

    const { Invalidation } = await cfClient.send(new GetInvalidationCommand(getInvalidationParams));
    invalidationStatus = Invalidation.Status;
    console.log(consoleYellow, "Invalidation is in progress...")

  } while (invalidationStatus !== 'Completed');
}

export async function invalidateCloudFront(cfClient, configInt) {

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
        console.log(consoleYellow, `CloudFront invalidation created:`, createResult.Invalidation.Id); 

        await waitForCloudFrontInvalidation(cfClient, configInt.cloudFrontDistributionId, createResult.Invalidation.Id); 
        console.log(consoleGreen, 'CloudFront invalidation completed successfully!'); 
    } catch (error) {
        console.error(consoleRed, 'CloudFront invalidation error:', error);
    }
}