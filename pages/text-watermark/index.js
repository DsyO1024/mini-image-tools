Page({
  data: {
    imageSrc: '',
    imageWidth: 0,
    imageHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,

    textContent: '水印文字',
    textSize: 30,
    textColor: '#ffffff',
    textOpacity: 80,
    textPosition: 'bottom-right',

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
    ],

    colorOptions: [
      '#ffffff', '#000000', '#ff4d4f', '#faad14',
      '#52c41a', '#1890ff', '#722ed1', '#eb2f96'
    ]
  },

  _canvas: null,
  _ctx: null,

  onReady() {
    this._initCanvas()
  },

  _initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#watermarkCanvas')
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

  onTextInput(e) { this.setData({ textContent: e.detail.value }) },
  onTextSizeChange(e) { this.setData({ textSize: Number(e.detail.value) }) },
  onTextColorTap(e) { this.setData({ textColor: e.currentTarget.dataset.color }) },
  onTextOpacityChange(e) { this.setData({ textOpacity: Number(e.detail.value) }) },
  onTextPositionChange(e) {
    this.setData({ textPosition: this.data.positionOptions[e.detail.value].value })
  },

  applyWatermark() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先选择图片', icon: 'none' }); return
    }
    this.setData({ processing: true })
    wx.showLoading({ title: '处理中...' })
    this._drawImageSync().then(() => this._applyTextWatermark())
  },

  _applyTextWatermark() {
    const ctx = this._ctx
    const { imageWidth, imageHeight, textContent, textSize, textColor, textOpacity, textPosition } = this.data
    const opacity = textOpacity / 100
    const fontSize = Math.floor(textSize * (imageWidth / 375))

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = textColor
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    if (textPosition === 'tile') {
      ctx.rotate(-Math.PI / 6)
      const metrics = ctx.measureText(textContent)
      const textW = metrics.width + 100
      const textH = fontSize + 80
      for (let x = -imageHeight; x < imageWidth + imageHeight; x += textW) {
        for (let y = -imageHeight; y < imageHeight * 2; y += textH) {
          ctx.fillText(textContent, x, y)
        }
      }
    } else {
      const metrics = ctx.measureText(textContent)
      const textW = metrics.width
      const padding = 40
      let x, y
      switch (textPosition) {
        case 'top-left': x = padding; y = padding + fontSize; break
        case 'top-right': x = imageWidth - textW - padding; y = padding + fontSize; break
        case 'bottom-left': x = padding; y = imageHeight - padding; break
        case 'bottom-right': x = imageWidth - textW - padding; y = imageHeight - padding; break
        case 'center': x = (imageWidth - textW) / 2; y = (imageHeight + fontSize) / 2; break
        default: x = imageWidth - textW - padding; y = imageHeight - padding
      }
      ctx.fillText(textContent, x, y)
    }
    ctx.restore()
    this._exportCanvas()
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
