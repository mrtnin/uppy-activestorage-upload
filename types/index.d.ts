import type { BasePlugin, PluginOptions } from '@uppy/core';

export interface ActiveStorageUploadOptions extends PluginOptions {
  limit?: number;
  timeout?: number;
  directUploadUrl: string;
  directUploadToken: string,
  directUploadAttachmentName: string,
}

declare class ActiveStorageUpload extends BasePlugin<ActiveStorageUploadOptions> {}

export default ActiveStorageUpload