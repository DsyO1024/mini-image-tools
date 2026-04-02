Page({
  data: {
    modules: [
      {
        id: 'watermark',
        name: '图片水印',
        desc: '文字水印 / 马赛克 / 图标水印',
        icon: 'watermark',
        path: '/pages/watermark/index'
      }
      // Future modules can be added here
    ]
  },

  onModuleTap(e) {
    const { path } = e.currentTarget.dataset
    wx.navigateTo({ url: path })
  }
})
