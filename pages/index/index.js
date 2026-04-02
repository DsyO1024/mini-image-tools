Page({
  data: {
    modules: [
      {
        id: 'text-watermark',
        name: '文字水印',
        desc: '自定义文字、颜色、位置，支持全屏平铺',
        emoji: '🔤',
        gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        path: '/pages/text-watermark/index'
      },
      {
        id: 'icon-watermark',
        name: '图片水印',
        desc: '自定义图标水印，支持透明度与平铺',
        emoji: '🖼️',
        gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
        path: '/pages/icon-watermark/index'
      },
      {
        id: 'mosaic',
        name: '马赛克',
        desc: '手指涂抹打码，自定义马赛克粗细',
        emoji: '🟦',
        gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
        path: '/pages/mosaic/index'
      }
    ]
  },

  onModuleTap(e) {
    const { path } = e.currentTarget.dataset
    wx.navigateTo({ url: path })
  }
})
