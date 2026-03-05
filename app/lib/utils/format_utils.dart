import 'package:intl/intl.dart';

/// 格式化 ISO 日期字符串为友好显示
String formatDateTime(String iso) {
  try {
    final dt = DateTime.parse(iso);
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    if (diff.inDays < 7) return '${diff.inDays} 天前';

    return DateFormat('yyyy-MM-dd HH:mm').format(dt.toLocal());
  } catch (_) {
    return iso;
  }
}

/// 截断字符串
String truncate(String text, int maxLength) {
  if (text.length <= maxLength) return text;
  return '${text.substring(0, maxLength)}...';
}
