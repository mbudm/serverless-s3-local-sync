const AWS = require('aws-sdk');
const glob = require('glob');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const messagePrefix = 'S3 Local Sync';


function getFileList(pattern = '**/*', opts = null) {
  return new Promise((resolve, reject) => {
    glob(pattern, opts, (er, files) => {
      if (er) {
        reject(er);
      } else {
        resolve(files);
      }
    });
  });
}

function cleanFilePathOfLocalDir(filePath, localDir) {
  return filePath.slice(localDir.length).replace(/^(\/)/, '');
}

function uploadFile(filePath, bucketName, localDir, client, cli) {
  return new Promise((resolve, reject) => {
    const params = {
      Key: cleanFilePathOfLocalDir(filePath, localDir),
      Bucket: bucketName,
      Body: fs.createReadStream(filePath),
      ContentType: mime.lookup(filePath) || 'application/octet-stream',
    };
    cli.consoleLog(`${messagePrefix} Uploading.. ${params.Key}`);
    client.upload(params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve('done');
      }
    });
  });
}

function uploadFiles(fileList, bucketName, localDir, client, cli) {
  return Promise.all(fileList.map(file => uploadFile(file, bucketName, localDir, client, cli)));
}

class ServerlessS3LocalSync {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.servicePath = this.serverless.service.serverless.config.servicePath;

    this.commands = {
      's3-local-sync': {
        usage: 'Syncs files from a local dir to \'s3 buckets\' created by the serverless-s3-local plugin',
        lifecycleEvents: [
          'sync',
        ],
      },
    };

    this.hooks = {
      's3-local-sync:sync': this.sync.bind(this),
      'before:offline:start:init': this.sync.bind(this),
      'before:offline:start': this.sync.bind(this),
    };
  }

  sync() {
    const { cli } = this.serverless;
    this.s3Sync = (this.serverless.service.custom && this.serverless.service.custom.s3Sync) || [];
    if (!Array.isArray(this.s3Sync)) {
      cli.consoleLog(`${messagePrefix} s3Sync is not an array`, this.s3Sync);
      return Promise.resolve();
    }

    this.s3 = this.serverless.service.custom.s3 || {};
    this.s3.port = this.s3.port || 5000;
    this.s3.host = this.s3.host || 'localhost';
    this.client = new AWS.S3({
      s3ForcePathStyle: true,
      endpoint: new AWS.Endpoint(`http://${this.s3.host}:${this.s3.port}`),
      accessKeyId: 'S3RVER',
      secretAccessKey: 'S3RVER',
    });

    cli.consoleLog(`${messagePrefix} Sync using port: ${this.s3.port} + ${this.servicePath}`);

    const promises = this.s3Sync.map((s) => {
      if (!s.bucketName || !s.localDir) {
        throw new Error('Invalid custom.s3Sync');
      }

      const localDirGlob = `${path.relative(process.cwd(), s.localDir)}/**/*`;
      cli.consoleLog(`${messagePrefix} Searching for files with pattern ${localDirGlob} to sync to bucket ${s.bucketName}.`);
      return getFileList(localDirGlob, { nodir: true })
        .then((fileList) => {
          cli.consoleLog(`${messagePrefix} Files found: ${JSON.stringify(fileList, null, 2)}`);
          return uploadFiles(fileList, s.bucketName, s.localDir, this.client, cli);
        });
    });

    return Promise.all(promises)
      .then(() => {
        cli.printDot();
        cli.consoleLog('');
        cli.consoleLog(`${messagePrefix} Synced.`);
      });
  }
}

module.exports = ServerlessS3LocalSync;
