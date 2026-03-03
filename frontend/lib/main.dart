import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/chat/viewmodels/chat_viewmodel.dart';
import 'features/agents/viewmodels/agents_viewmodel.dart';
import 'features/settings/viewmodels/settings_viewmodel.dart';

void main() {
  runApp(const CloudBrainApp());
}

class CloudBrainApp extends StatelessWidget {
  const CloudBrainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatViewModel()),
        ChangeNotifierProvider(create: (_) => AgentsViewModel()),
        ChangeNotifierProvider(create: (_) => SettingsViewModel()),
      ],
      child: MaterialApp.router(
        title: 'CloudBrain',
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        routerConfig: appRouter,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
