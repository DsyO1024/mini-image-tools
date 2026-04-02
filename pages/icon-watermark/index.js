Page({
  data: {
    imageSrc: '',
    imageWidth: 0,
    imageHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,

    iconSrc: '',
    iconSize: 80,
    iconOpacity: 80,
    iconPosition: 'bottom-right',

    showResult: false,
    resultImageSrc: '',
    processing: false,

    positionOptions: [
      { value: 'top-left', label: '左上' },
      { value: 'top-right', label: '右上' },
      { value: 'bottom-left', label: '左下' },
      { value: 'bottom-right', label: '右下' },
      { value: 'center', label: '居中' },
      { value: 'tile', label: '平铺' }
    ]
  },

  _canvas: null,
  _ctx: null,

  onReady() {
    this._initCanvas()
  },

  _initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#iconCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          this._canvas = res[0].node
          this._ctx = this._canvas.getContext('2d')
        }
      })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this._loadImage(res.tempFiles[0].tempFilePath)
      }
    })
  },

  _loadImage(src) {
    wx.showLoading({ title: '加载中...' })
    wx.getImageInfo({
      src,
      success: (info) => {
        const sysInfo = wx.getWindowInfo()
        const maxW = sysInfo.windowWidth - 30
        const scale = maxW / info.width
        this.setData({
          imageSrc: src,
          imageWidth: info.width,
          imageHeight: info.height,
          canvasWidth: Math.floor(maxW),
          canvasHeight: Math.floor(info.height * scale),
          showResult: false,
          resultImageSrc: ''
        }, () => this._drawImage())
      },
      fail: () => wx.showToast({ title: '加载图片失败', icon: 'none' }),
      complete: () => wx.hideLoading()
    })
  },

  _drawImage() {
    if (!this._canvas) {
      setTimeout(() => { this._initCanvas(); setTimeout(() => this._drawImage(), 200) }, 200)
      return
    }
    const canvas = this._canvas
    const ctx = this._ctx
    const { imageWidth, imageHeight } = this.data
    canvas.width = imageWidth
    canvas.height = imageHeight
    const img = canvas.createImage()
    img.onload = () => {
      ctx.clearRect(0, 0, imageWidth, imageHeight)
      ctx.drawImage(img, 0, 0, imageWidth, imageHeight)
    }
    img.src = this.data.imageSrc
  },

  _drawImageSync() {
    return new Promise((resolve) => {
      if (!this._canvas) { resolve(); return }
      const canvas = this._canvas
      const ctx = this._ctx
      const { imageWidth, imageHeight } = this.data
      canvas.width = imageWidth
      canvas.height = imageHeight
      const img = canvas.createImage()
      img.onload = () => {
        ctx.clearRect(0, 0, imageWidth, imageHeight)
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = this.data.imageSrc
    })
  },

  chooseIcon() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({ iconSrc: res.tempFiles[0].tempFilePath })
      }
    })
  },

  onIconSizeChange(e) { this.setData({ iconSize: Number(e.detail.value) }) },
  onIconOpacityChange(e) { this.setData({ iconOpacity: Number(e.detail.value) }) },
  onIconPositionChange(e) {
    this.setData({ iconPosition: this.data.positionOptions[e.detail.value].value })
  },

  applyWatermark() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先选择图片', icon: 'none' }); return
    }
    if (!this.data.iconSrc) {
      wx.showToast({ title: '请先选择水印图标', icon: 'none' }); return
    }
    this.setData({ processing: true })
    wx.showLoading({ title: '处理中...' })
    this._drawImageSync().then(() => this._applyIconWatermark())
  },

  _applyIconWatermark() {
    const ctx = this._ctx
    const canvas = this._canvas
    const { imageWidth, imageHeight, iconSize, iconOpacity, iconPosition } = this.data
    const opacity = iconOpacity / 100
    const size = Math.floor(iconSize * (imageWidth / 375))

    const iconImg = canvas.createImage()
    iconImg.onload = () => {
      ctx.save()
      ctx.globalAlpha = opacity
      const padding = 40

      if (iconPosition === 'tile') {
        const gap = size + 60
        for (let x = 0; x < imageWidth; x += gap) {
          for (let y = 0; y < imageHeight; y += gap) {
            ctx.drawImage(iconImg, x, y, size, size)
          }
        }
      } else {
        let x, y
        switch (iconPosition) {
          case 'top-left': x = padding; y = padding; break
          case 'top-right': x = imageWidth - size - padding; y = padding; break
          case 'bottom-left': x = padding; y = imageHeight - size - padding; break
          case 'bottom-right': x = imageWidth - size - padding; y = imageHeight - size - padding; break
          case 'center': x = (imageWidth - size) / 2; y = (imageHeight - size) / 2; break
          default: x = imageWidth - size - padding; y = imageHeight - size - padding
        }
        ctx.drawImage(iconImg, x, y, size, size)
      }
      ctx.restore()
      this._exportCanvas()
    }
    iconImg.onerror = () => {
      wx.hideLoading(); this.setData({ processing: false })
      wx.showToast({ title: '加载水印图标失败', icon: 'none' })
    }
    iconImg.src = this.data.iconSrc
  },

  _exportCanvas() {
    const { imageWidth, imageHeight } = this.data
    wx.canvasToTempFilePath({
      canvas: this._canvas, x: 0, y: 0,
      width: imageWidth, height: imageHeight,
      destWidth: imageWidth, destHeight: imageHeight,
      fileType: 'png', quality: 1,
      success: (res) => {
        this.setData({ resultImageSrc: res.tempFilePath, showResult: true, processing: false })
        wx.hideLoading()
      },
      fail: () => {
        this.setData({ processing: false }); wx.hideLoading()
        wx.showToast({ title: '导出图片失败', icon: 'none' })
      }
    })
  },

  saveToAlbum() {
    if (!this.data.resultImageSrc) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImageSrc,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '提示', content: '需要授权保存图片到相册', confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting() }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  previewResult() {
    if (this.data.resultImageSrc) {
      wx.previewImage({ current: this.data.resultImageSrc, urls: [this.data.resultImageSrc] })
    }
  },

  closeResult() { this.setData({ showResult: false }) },

  reSelectImage() {
    this.setData({ showResult: false, resultImageSrc: '' })
    this.chooseImage()
  }
})
