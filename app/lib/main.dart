import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'core/lifecycle/app_lifecycle_manager.dart';
import 'features/chat/viewmodels/chat_viewmodel.dart';
import 'features/agents/viewmodels/agents_viewmodel.dart';
import 'features/settings/viewmodels/settings_viewmodel.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化生命周期管理器
  final lifecycle = AppLifecycleManager();
  await lifecycle.init();

  runApp(BiosBotApp(lifecycle: lifecycle));
}

class BiosBotApp extends StatefulWidget {
  final AppLifecycleManager lifecycle;
  const BiosBotApp({super.key, required this.lifecycle});

  @override
  State<BiosBotApp> createState() => _BiosBotAppState();
}

class _BiosBotAppState extends State<BiosBotApp> {
  late final ChatViewModel _chatVm;
  late final AgentsViewModel _agentsVm;
  late final SettingsViewModel _settingsVm;

  @override
  void initState() {
    super.initState();
    _chatVm = ChatViewModel();
    _agentsVm = AgentsViewModel();
    _settingsVm = SettingsViewModel();

    // 注册到生命周期管理器
    widget.lifecycle.addListener(_chatVm);
    widget.lifecycle.addListener(_agentsVm);
  }

  @override
  void dispose() {
    widget.lifecycle.removeListener(_chatVm);
    widget.lifecycle.removeListener(_agentsVm);
    widget.lifecycle.dispose();
    _chatVm.dispose();
    _agentsVm.dispose();
    _settingsVm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _chatVm),
        ChangeNotifierProvider.value(value: _agentsVm),
        ChangeNotifierProvider.value(value: _settingsVm),
      ],
      child: MaterialApp.router(
        title: 'BiosBot',
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        routerConfig: appRouter,
        debugShowCheckedModeBanner: false,
        restorationScopeId: 'biosbot_root',
      ),
    );
  }
}
