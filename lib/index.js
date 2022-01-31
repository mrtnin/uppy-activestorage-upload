const BasePlugin = require('@uppy/core/lib/BasePlugin')
const { nanoid } = require('nanoid/non-secure')
const settle = require('@uppy/utils/lib/settle')
const EventTracker = require('@uppy/utils/lib/EventTracker')
const ProgressTimeout = require('@uppy/utils/lib/ProgressTimeout')
const { RateLimitedQueue, internalRateLimitedQueue } = require('@uppy/utils/lib/RateLimitedQueue')
const { DirectUpload } = require('@rails/activestorage');

const locale = require('./locale')

module.exports = class ActiveStorageUpload extends BasePlugin {
  constructor (uppy, opts) {
    super(uppy, opts);

    this.id = this.opts.id || 'ActiveStorageUpload'
    this.title = 'ActiveStorageUpload'
    this.type = 'uploader';

    this.defaultLocale = locale

    // Default options
    const defaultOptions = {
      limit: 5,
      timeout: 30 * 1000,
      directUploadUrl: null,
      directUploadToken: null,
      directUploadAttachmentName: null,
    };

    this.opts = { ...defaultOptions, ...opts }
    this.i18nInit()

    this.handleUpload = this.handleUpload.bind(this)

    this.requests = new RateLimitedQueue(this.opts.limit)

    if (!this.opts.directUploadUrl || !this.opts.directUploadToken || !this.opts.directUploadAttachmentName) {
      throw new Error('All direct upload options must be present')
    }

    this.uploaderEvents = Object.create(null)
  }

  upload (file, current, total) {
    const opts = this.opts;

    this.uppy.log(`uploading ${current} of ${total}`)
    return new Promise((resolve, reject) => {
      this.uppy.emit('upload-started', file)

      const { data, meta } = file;

      if (!data.name && meta.name) {
        data.name = meta.name;
      }

      let directUploadHandlers = {
        directUploadWillStoreFileWithXHR: null,
        directUploadDidProgress: null,
      };

      const timer = new ProgressTimeout(opts.timeout, () => {
        this.xhr.abort()
        queuedRequest.done()
        const error = new Error(this.i18n('timedOut', { seconds: Math.ceil(opts.timeout / 1000) }))
        this.uppy.emit('upload-error', file, error)
        reject(error)
      })

      // Bind xhr from DirectUpload so we can abort()
      directUploadHandlers.directUploadWillStoreFileWithXHR = xhr => {
         this.xhr = xhr;
      }

      directUploadHandlers.directUploadDidProgress = event => {
        this.uppy.log(`[ActiveStorageUpload] ${id} progress: ${event.loaded} / ${event.total}`);
        timer.progress();

        if (event.lengthComputable) {
          this.uppy.emit('upload-progress', file, {
            uploader: this,
            bytesUploaded: event.loaded,
            bytesTotal: event.total,
          });
        }
      };

      const upload = new DirectUpload(data, this.opts.directUploadUrl, this.opts.directUploadToken, this.opts.directUploadAttachmentName, directUploadHandlers);
      const id = nanoid()

      const uploadCallback = (error, blob) => {
        this.uppy.log(`[ActiveStorageUpload] ${id} finished`);

        timer.done()
        queuedRequest.done()

        if (this.uploaderEvents[file.id]) {
          this.uploaderEvents[file.id].remove()
          this.uploaderEvents[file.id] = null
        }

        if (error) {
          const response = {
            status: 'error',
          };

          this.uppy.setFileState(file.id, { response });

          this.uppy.emit('upload-error', file, error);
          return reject(error);
        } else {
          const response = {
            status: 'success',
            directUploadSignedId: blob.signed_id,
          };

          this.uppy.setFileState(file.id, { response });

          this.uppy.emit('upload-success', file, blob);

          return resolve(file);
        }
      };

      this.uploaderEvents[file.id] = new EventTracker(this.uppy)

      const queuedRequest = this.requests.run(() => {
        this.uppy.emit('upload-started', file)

        upload.create(uploadCallback)

        return () => {
          timer.done()
          this.xhr.abort()
        }
      })

      this.onFileRemove(file.id, () => {
        queuedRequest.abort()
        reject(new Error('File removed'))
      })

      this.onCancelAll(file.id, () => {
        queuedRequest.abort()
        reject(new Error('Upload cancelled'))
      })
    })
  }

  uploadFiles (files) {
    const promises = files.map((file, i) => {
      const current = parseInt(i, 10) + 1
      const total = files.length

      if (file.error) {
        return Promise.reject(new Error(file.error))
      } else {
        return this.upload(file, current, total)
      }
    })

    return settle(promises)
  }

  onFileRemove (fileID, cb) {
    this.uploaderEvents[fileID].on('file-removed', (file) => {
      if (fileID === file.id) cb(file.id)
    })
  }

  onCancelAll (fileID, cb) {
    this.uploaderEvents[fileID].on('cancel-all', () => {
      if (!this.uppy.getFile(fileID)) return
      cb()
    })
  }

  handleUpload (fileIDs) {
    if (fileIDs.length === 0) {
      this.uppy.log('[ActiveStorageUpload] No files to upload!')
      return Promise.resolve()
    }

    this.uppy.log('[ActiveStorageUpload] Uploading...')
    const files = fileIDs.map((fileID) => this.uppy.getFile(fileID))

    return this.uploadFiles(files).then(() => null)
  }

  install () {
    this.uppy.addUploader(this.handleUpload)
  }

  uninstall () {
    this.uppy.removeUploader(this.handleUpload)
  }
}