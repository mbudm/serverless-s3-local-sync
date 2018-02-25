# serverless-s3-local-sync
serverless plugin that syncs a directory with a local s3 bucket

## Works with these plugins:
- https://github.com/ar90n/serverless-s3-local
- https://github.com/k1LoW/serverless-s3-sync

## Example serverless.yml
``` yml
plugins:
  - serverless-offline # this plugin uses offline hooks
  - serverless-s3-sync # not required but this plugin uses the s3Sync custom config
  - serverless-s3-local # creates the local 'bucket'
  - serverless-s3-local-sync # specify this plugin last, as it relies on the others

custom:
  s3: # serverless-s3-local config
    host: 0.0.0.0
    port: 5000
    directory: /tmp/s3bucket
    cors: false
    # noStart: true
  s3Sync: # serverless-s3-sync cobfig
    - bucketName: yourBucketName
      localDir: src 
```
