# BiosBot App Icons

## 生成应用图标

Flutter 应用图标需要 PNG 格式。请按以下步骤生成：

### 方法 1: 使用在线工具

1. 打开 [SVG to PNG Converter](https://svgtopng.com/) 或类似工具
2. 上传 `app_icon.svg`
3. 导出为 1024x1024 PNG，保存为 `app_icon.png`
4. 创建前景图: 512x512 PNG (图标内容无背景)，保存为 `app_icon_foreground.png`

### 方法 2: 使用命令行 (需要安装 Inkscape 或 ImageMagick)

```bash
# 使用 Inkscape
inkscape -w 1024 -h 1024 app_icon.svg -o app_icon.png

# 使用 ImageMagick (rsvg-convert)
rsvg-convert -w 1024 -h 1024 app_icon.svg > app_icon.png
```

### 生成 Flutter 图标

将 PNG 文件放到此目录后，在 `app/` 目录下运行:

```bash
flutter pub get
flutter pub run flutter_launcher_icons
```

这会自动生成 Android 和 iOS 所需的所有尺寸图标。

## 图标规格

- **app_icon.png**: 1024x1024, 完整图标 (带背景)
- **app_icon_foreground.png**: 512x512, 前景图 (用于 Android 自适应图标)

## 颜色参考

- 主色: #00bcd4 (青色)
- 渐变终点: #4caf50 (绿色)
- 图标内容: 白色 (#FFFFFF)
