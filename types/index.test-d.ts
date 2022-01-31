import Uppy from '@uppy/core'
import ActiveStorageUpload from '..'

new Uppy().use(ActiveStorageUpload, {
    limit: 5,
    timeout: 5000,
    directUploadUrl: "/rails/direct_upload",
    directUploadToken: "token",
    directUploadAttachmentName: "upload#name",
})

new Uppy().use(ActiveStorageUpload, {
    directUploadUrl: "/rails/direct_upload",
    directUploadToken: "token",
    directUploadAttachmentName: "upload#name",
})
