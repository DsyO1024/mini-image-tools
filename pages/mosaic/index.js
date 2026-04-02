Page({
  data: {
    imageSrc: '',
    imageWidth: 0,
    imageHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,

    // 打码模式: 'pixel' | 'emoji'
    mosaicMode: 'pixel',

    // 像素马赛克
    mosaicSize: 15,
    mosaicTouching: false,
    mosaicPaths: [],

    // Emoji 打码
    emojiOptions: ['😀', '😂', '🥰', '😎', '🤪', '😈', '💩', '👻', '🐶', '🐱', '🌟', '❤️'],
    selectedEmoji: '😀',
    emojiSize: 40,

    showResult: false,
    resultImageSrc: '',
    processing: false
  },

  _canvas: null,
  _ctx: null,
  _originalImageData: null,

  onReady() {
    this._initCanvas()
  },

  _initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#mosaicCanvas')
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
          resultImageSrc: '',
          mosaicPaths: []
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
      this._originalImageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    }
    img.src = this.data.imageSrc
  },

  // 模式切换
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mosaicMode: mode, mosaicPaths: [] })
    this._drawImage()
  },

  // Emoji 选择
  onEmojiTap(e) {
    this.setData({ selectedEmoji: e.currentTarget.dataset.emoji })
  },

  onEmojiSizeChange(e) {
    this.setData({ emojiSize: Number(e.detail.value) })
  },

  // Touch handling for mosaic painting
  onCanvasTouchStart(e) {
    if (!this.data.imageSrc) return
    const touch = e.touches[0]
    const paths = this.data.mosaicPaths.slice()
    paths.push([this._canvasToImageCoords(touch.x, touch.y)])
    this.setData({ mosaicTouching: true, mosaicPaths: paths })
  },

  onCanvasTouchMove(e) {
    if (!this.data.mosaicTouching) return
    const touch = e.touches[0]
    const paths = this.data.mosaicPaths.slice()
    paths[paths.length - 1].push(this._canvasToImageCoords(touch.x, touch.y))
    this.setData({ mosaicPaths: paths })
    this._applyMosaicRealtime()
  },

  onCanvasTouchEnd() {
    if (!this.data.mosaicTouching) return
    this.setData({ mosaicTouching: false })
  },

  _canvasToImageCoords(x, y) {
    const { canvasWidth, canvasHeight, imageWidth, imageHeight } = this.data
    return {
      x: Math.floor((x / canvasWidth) * imageWidth),
      y: Math.floor((y / canvasHeight) * imageHeight)
    }
  },

  _applyMosaicRealtime() {
    if (!this._originalImageData || !this._ctx) return

    if (this.data.mosaicMode === 'pixel') {
      this._applyPixelMosaicRealtime()
    } else {
      this._applyEmojiMosaicRealtime()
    }
  },

  _applyPixelMosaicRealtime() {
    const ctx = this._ctx
    const { imageWidth, imageHeight, mosaicPaths, mosaicSize } = this.data

    ctx.putImageData(this._originalImageData, 0, 0)
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    const data = imageData.data
    const blockSize = mosaicSize

    for (const path of mosaicPaths) {
      for (const point of path) {
        const cx = point.x, cy = point.y
        const radius = blockSize * 2
        for (let bx = cx - radius; bx < cx + radius; bx += blockSize) {
          for (let by = cy - radius; by < cy + radius; by += blockSize) {
            if (bx < 0 || by < 0 || bx >= imageWidth || by >= imageHeight) continue
            let r = 0, g = 0, b = 0, count = 0
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++
              }
            }
            r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count)
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                data[idx] = r; data[idx + 1] = g; data[idx + 2] = b
              }
            }
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
  },

  _applyEmojiMosaicRealtime() {
    const ctx = this._ctx
    const { imageWidth, mosaicPaths, selectedEmoji, emojiSize } = this.data
    const size = Math.floor(emojiSize * (imageWidth / 375))

    ctx.putImageData(this._originalImageData, 0, 0)

    // 记录已绘制的位置，避免重叠
    const drawnSet = new Set()

    ctx.save()
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const path of mosaicPaths) {
      for (const point of path) {
        // 计算网格位置
        const gridX = Math.floor(point.x / size) * size + size / 2
        const gridY = Math.floor(point.y / size) * size + size / 2
        const key = `${gridX},${gridY}`

        if (!drawnSet.has(key)) {
          drawnSet.add(key)
          ctx.fillText(selectedEmoji, gridX, gridY)
        }
      }
    }
    ctx.restore()
  },

  onMosaicSizeChange(e) { this.setData({ mosaicSize: Number(e.detail.value) }) },

  clearMosaic() {
    this.setData({ mosaicPaths: [] })
    this._drawImage()
  },

  applyMosaic() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先选择图片', icon: 'none' }); return
    }
    if (this.data.mosaicPaths.length === 0) {
      wx.showToast({ title: '请先在图片上涂抹需要打码的区域', icon: 'none' }); return
    }
    this.setData({ processing: true })
    wx.showLoading({ title: '处理中...' })

    // Re-apply mosaic from original data
    if (this._originalImageData) {
      this._ctx.putImageData(this._originalImageData, 0, 0)
    }

    if (this.data.mosaicMode === 'pixel') {
      this._applyPixelMosaicFinal()
    } else {
      this._applyEmojiMosaicFinal()
    }
  },

  _applyPixelMosaicFinal() {
    const { imageWidth, imageHeight, mosaicPaths, mosaicSize } = this.data
    const ctx = this._ctx
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    const data = imageData.data
    const blockSize = mosaicSize

    for (const path of mosaicPaths) {
      for (const point of path) {
        const cx = point.x, cy = point.y
        const radius = blockSize * 2
        for (let bx = cx - radius; bx < cx + radius; bx += blockSize) {
          for (let by = cy - radius; by < cy + radius; by += blockSize) {
            if (bx < 0 || by < 0 || bx >= imageWidth || by >= imageHeight) continue
            let r = 0, g = 0, b = 0, count = 0
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++
              }
            }
            r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count)
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                data[idx] = r; data[idx + 1] = g; data[idx + 2] = b
              }
            }
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
    this._exportCanvas()
  },

  _applyEmojiMosaicFinal() {
    const ctx = this._ctx
    const { imageWidth, mosaicPaths, selectedEmoji, emojiSize } = this.data
    const size = Math.floor(emojiSize * (imageWidth / 375))

    const drawnSet = new Set()
    ctx.save()
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const path of mosaicPaths) {
      for (const point of path) {
        const gridX = Math.floor(point.x / size) * size + size / 2
        const gridY = Math.floor(point.y / size) * size + size / 2
        const key = `${gridX},${gridY}`

        if (!drawnSet.has(key)) {
          drawnSet.add(key)
          ctx.fillText(selectedEmoji, gridX, gridY)
        }
      }
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
    this.setData({ showResult: false, resultImageSrc: '', mosaicPaths: [] })
    this.chooseImage()
  }
})
