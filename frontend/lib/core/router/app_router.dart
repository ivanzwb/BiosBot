import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_shell.dart';
import '../../features/chat/pages/chat_page.dart';
import '../../features/agents/pages/agents_page.dart';
import '../../features/agents/pages/agent_config_page.dart';
import '../../features/settings/pages/settings_page.dart';
import '../../features/onboarding/pages/onboarding_page.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/chat',
  restorationScopeId: 'cloudbrain_router',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return AppShell(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/chat',
              builder: (context, state) => const ChatPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/agents',
              builder: (context, state) => const AgentsPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (context, state) => const SettingsPage(),
            ),
          ],
        ),
      ],
    ),
    // 全屏页面（不带底部导航）
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/agents/:id/config',
      builder: (context, state) => AgentConfigPage(
        agentId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/onboarding',
      builder: (context, state) => const OnboardingPage(),
    ),
  ],
);
