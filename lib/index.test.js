const Core = require('@uppy/core')

const options = {
  directUploadUrl: "https://fake-app.io/rails/direct_upload",
  directUploadToken: "fake-token",
  directUploadAttachmentName: "upload#file",
}

const ActiveStorageUpload = require('./index')

describe('ActiveStorageUpload', () => {
  it('Registers ActiveStorageUpload upload plugin', () => {
    const core = new Core()
    core.use(ActiveStorageUpload, options)

    const pluginNames = core[Symbol.for('uppy test: getPlugins')]('uploader').map((plugin) => plugin.constructor.name)
    expect(pluginNames).toContain('ActiveStorageUpload')
  })

  describe('options', () => {
    it('Throws an error if configured without directUpload options', () => {
      expect(() => {
        new ActiveStorageUpload();
      }).toThrow();
    })
  })
})