const MOSAIC_BLOCK_SIZE = 10 // Mosaic pixel block size

Page({
  data: {
    // Image state
    imageSrc: '',
    imageWidth: 0,
    imageHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,

    // Watermark mode: 'text' | 'mosaic' | 'icon'
    mode: 'text',

    // Text watermark config
    textContent: '水印文字',
    textSize: 30,
    textColor: '#ffffff',
    textOpacity: 80,
    textPosition: 'bottom-right', // 'top-left','top-right','bottom-left','bottom-right','center','tile'

    // Mosaic config
    mosaicSize: 15,
    mosaicTouching: false,
    mosaicPaths: [], // Array of touch point arrays

    // Icon watermark config
    iconSrc: '',
    iconSize: 80,
    iconOpacity: 80,
    iconPosition: 'bottom-right',

    // UI state
    showResult: false,
    resultImageSrc: '',
    processing: false,

    // Position options for dropdown
    positionOptions: [
      { value: 'top-left', label: '左上' },
      { value: 'top-right', label: '右上' },
      { value: 'bottom-left', label: '左下' },
      { value: 'bottom-right', label: '右下' },
      { value: 'center', label: '居中' },
      { value: 'tile', label: '平铺' }
    ],

    // Color options
    colorOptions: [
      '#ffffff', '#000000', '#ff4d4f', '#faad14',
      '#52c41a', '#1890ff', '#722ed1', '#eb2f96'
    ]
  },

  _canvas: null,
  _ctx: null,
  _originalImageData: null,

  onReady() {
    this._initCanvas()
  },

  _initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#watermarkCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node
          this._canvas = canvas
          this._ctx = canvas.getContext('2d')
        }
      })
  },

  // Choose image from album
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this._loadImage(tempFilePath)
      }
    })
  },

  _loadImage(src) {
    wx.showLoading({ title: '加载中...' })
    wx.getImageInfo({
      src,
      success: (info) => {
        const sysInfo = wx.getWindowInfo()
        const screenWidth = sysInfo.windowWidth
        const maxCanvasWidth = screenWidth - 30 // padding
        const scale = maxCanvasWidth / info.width
        const canvasWidth = Math.floor(maxCanvasWidth)
        const canvasHeight = Math.floor(info.height * scale)

        this.setData({
          imageSrc: src,
          imageWidth: info.width,
          imageHeight: info.height,
          canvasWidth,
          canvasHeight,
          showResult: false,
          resultImageSrc: '',
          mosaicPaths: []
        }, () => {
          this._drawOriginalImage()
        })
      },
      fail: () => {
        wx.showToast({ title: '加载图片失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  _drawOriginalImage() {
    if (!this._canvas) {
      // Canvas not ready, retry
      setTimeout(() => {
        this._initCanvas()
        setTimeout(() => this._drawOriginalImage(), 200)
      }, 200)
      return
    }

    const canvas = this._canvas
    const ctx = this._ctx
    const { imageWidth, imageHeight } = this.data

    // Set canvas actual pixel size (use original image size for quality)
    canvas.width = imageWidth
    canvas.height = imageHeight

    const img = canvas.createImage()
    img.onload = () => {
      ctx.clearRect(0, 0, imageWidth, imageHeight)
      ctx.drawImage(img, 0, 0, imageWidth, imageHeight)
      // Store original image data for mosaic reset
      this._originalImageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    }
    img.onerror = () => {
      wx.showToast({ title: '渲染图片失败', icon: 'none' })
    }
    img.src = this.data.imageSrc
  },

  // Switch watermark mode
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode })
    if (this.data.imageSrc) {
      this._drawOriginalImage()
    }
  },

  // ====== Text Watermark ======
  onTextInput(e) {
    this.setData({ textContent: e.detail.value })
  },

  onTextSizeChange(e) {
    this.setData({ textSize: Number(e.detail.value) })
  },

  onTextColorTap(e) {
    this.setData({ textColor: e.currentTarget.dataset.color })
  },

  onTextOpacityChange(e) {
    this.setData({ textOpacity: Number(e.detail.value) })
  },

  onTextPositionChange(e) {
    const idx = e.detail.value
    this.setData({ textPosition: this.data.positionOptions[idx].value })
  },

  // ====== Mosaic ======
  onMosaicSizeChange(e) {
    this.setData({ mosaicSize: Number(e.detail.value) })
  },

  onCanvasTouchStart(e) {
    if (this.data.mode !== 'mosaic' || !this.data.imageSrc) return
    const touch = e.touches[0]
    const paths = this.data.mosaicPaths.slice()
    paths.push([this._canvasToImageCoords(touch.x, touch.y)])
    this.setData({ mosaicTouching: true, mosaicPaths: paths })
  },

  onCanvasTouchMove(e) {
    if (!this.data.mosaicTouching) return
    const touch = e.touches[0]
    const paths = this.data.mosaicPaths.slice()
    const currentPath = paths[paths.length - 1]
    currentPath.push(this._canvasToImageCoords(touch.x, touch.y))
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
    const ctx = this._ctx
    const { imageWidth, imageHeight, mosaicPaths, mosaicSize } = this.data

    // Restore original image
    ctx.putImageData(this._originalImageData, 0, 0)

    // Apply mosaic on paths
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    const data = imageData.data
    const blockSize = mosaicSize

    for (const path of mosaicPaths) {
      for (const point of path) {
        const cx = point.x
        const cy = point.y
        const radius = blockSize * 2

        for (let bx = cx - radius; bx < cx + radius; bx += blockSize) {
          for (let by = cy - radius; by < cy + radius; by += blockSize) {
            if (bx < 0 || by < 0 || bx >= imageWidth || by >= imageHeight) continue

            // Average color in block
            let r = 0, g = 0, b = 0, count = 0
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                r += data[idx]
                g += data[idx + 1]
                b += data[idx + 2]
                count++
              }
            }
            r = Math.floor(r / count)
            g = Math.floor(g / count)
            b = Math.floor(b / count)

            // Fill block with average color
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                data[idx] = r
                data[idx + 1] = g
                data[idx + 2] = b
              }
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  },

  clearMosaic() {
    this.setData({ mosaicPaths: [] })
    this._drawOriginalImage()
  },

  // ====== Icon Watermark ======
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

  onIconSizeChange(e) {
    this.setData({ iconSize: Number(e.detail.value) })
  },

  onIconOpacityChange(e) {
    this.setData({ iconOpacity: Number(e.detail.value) })
  },

  onIconPositionChange(e) {
    const idx = e.detail.value
    this.setData({ iconPosition: this.data.positionOptions[idx].value })
  },

  // ====== Apply Watermark ======
  applyWatermark() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    const { mode } = this.data
    this.setData({ processing: true })
    wx.showLoading({ title: '处理中...' })

    // First redraw original image, then apply watermark
    this._drawOriginalImageSync().then(() => {
      if (mode === 'text') {
        this._applyTextWatermark()
      } else if (mode === 'mosaic') {
        this._applyMosaicFinal()
      } else if (mode === 'icon') {
        this._applyIconWatermark()
      }
    })
  },

  _drawOriginalImageSync() {
    return new Promise((resolve) => {
      if (!this._canvas) {
        resolve()
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
        resolve()
      }
      img.onerror = () => resolve()
      img.src = this.data.imageSrc
    })
  },

  _applyTextWatermark() {
    const ctx = this._ctx
    const { imageWidth, imageHeight, textContent, textSize, textColor, textOpacity, textPosition } = this.data
    const opacity = textOpacity / 100
    const fontSize = Math.floor(textSize * (imageWidth / 375)) // Scale relative to image

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = textColor
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    if (textPosition === 'tile') {
      // Tile mode
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
        case 'top-left':
          x = padding
          y = padding + fontSize
          break
        case 'top-right':
          x = imageWidth - textW - padding
          y = padding + fontSize
          break
        case 'bottom-left':
          x = padding
          y = imageHeight - padding
          break
        case 'bottom-right':
          x = imageWidth - textW - padding
          y = imageHeight - padding
          break
        case 'center':
          x = (imageWidth - textW) / 2
          y = (imageHeight + fontSize) / 2
          break
        default:
          x = imageWidth - textW - padding
          y = imageHeight - padding
      }

      ctx.fillText(textContent, x, y)
    }

    ctx.restore()
    this._exportCanvas()
  },

  _applyMosaicFinal() {
    // Mosaic already applied via touch, just re-apply and export
    if (this._originalImageData) {
      this._ctx.putImageData(this._originalImageData, 0, 0)
    }

    const { imageWidth, imageHeight, mosaicPaths, mosaicSize } = this.data

    if (mosaicPaths.length === 0) {
      wx.hideLoading()
      this.setData({ processing: false })
      wx.showToast({ title: '请先在图片上涂抹需要打码的区域', icon: 'none' })
      return
    }

    const ctx = this._ctx
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight)
    const data = imageData.data
    const blockSize = mosaicSize

    for (const path of mosaicPaths) {
      for (const point of path) {
        const cx = point.x
        const cy = point.y
        const radius = blockSize * 2

        for (let bx = cx - radius; bx < cx + radius; bx += blockSize) {
          for (let by = cy - radius; by < cy + radius; by += blockSize) {
            if (bx < 0 || by < 0 || bx >= imageWidth || by >= imageHeight) continue

            let r = 0, g = 0, b = 0, count = 0
            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                r += data[idx]
                g += data[idx + 1]
                b += data[idx + 2]
                count++
              }
            }
            r = Math.floor(r / count)
            g = Math.floor(g / count)
            b = Math.floor(b / count)

            for (let dx = 0; dx < blockSize && bx + dx < imageWidth; dx++) {
              for (let dy = 0; dy < blockSize && by + dy < imageHeight; dy++) {
                const idx = ((by + dy) * imageWidth + (bx + dx)) * 4
                data[idx] = r
                data[idx + 1] = g
                data[idx + 2] = b
              }
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    this._exportCanvas()
  },

  _applyIconWatermark() {
    if (!this.data.iconSrc) {
      wx.hideLoading()
      this.setData({ processing: false })
      wx.showToast({ title: '请先选择水印图标', icon: 'none' })
      return
    }

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
          case 'top-left':
            x = padding
            y = padding
            break
          case 'top-right':
            x = imageWidth - size - padding
            y = padding
            break
          case 'bottom-left':
            x = padding
            y = imageHeight - size - padding
            break
          case 'bottom-right':
            x = imageWidth - size - padding
            y = imageHeight - size - padding
            break
          case 'center':
            x = (imageWidth - size) / 2
            y = (imageHeight - size) / 2
            break
          default:
            x = imageWidth - size - padding
            y = imageHeight - size - padding
        }
        ctx.drawImage(iconImg, x, y, size, size)
      }

      ctx.restore()
      this._exportCanvas()
    }
    iconImg.onerror = () => {
      wx.hideLoading()
      this.setData({ processing: false })
      wx.showToast({ title: '加载水印图标失败', icon: 'none' })
    }
    iconImg.src = this.data.iconSrc
  },

  _exportCanvas() {
    const { imageWidth, imageHeight } = this.data
    wx.canvasToTempFilePath({
      canvas: this._canvas,
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight,
      destWidth: imageWidth,
      destHeight: imageHeight,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        this.setData({
          resultImageSrc: res.tempFilePath,
          showResult: true,
          processing: false
        })
        wx.hideLoading()
      },
      fail: () => {
        this.setData({ processing: false })
        wx.hideLoading()
        wx.showToast({ title: '导出图片失败', icon: 'none' })
      }
    })
  },

  // Save to album
  saveToAlbum() {
    if (!this.data.resultImageSrc) return

    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImageSrc,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '提示',
            content: '需要授权保存图片到相册',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  // Preview result
  previewResult() {
    if (this.data.resultImageSrc) {
      wx.previewImage({
        current: this.data.resultImageSrc,
        urls: [this.data.resultImageSrc]
      })
    }
  },

  // Close result view
  closeResult() {
    this.setData({ showResult: false })
  },

  // Re-select image
  reSelectImage() {
    this.setData({
      showResult: false,
      resultImageSrc: '',
      mosaicPaths: []
    })
    this.chooseImage()
  }
})
