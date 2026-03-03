import 'package:go_router/go_router.dart';
import '../../features/chat/pages/chat_page.dart';
import '../../features/agents/pages/agents_page.dart';
import '../../features/agents/pages/agent_detail_page.dart';
import '../../features/settings/pages/settings_page.dart';
import '../../features/onboarding/pages/onboarding_page.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/chat',
  routes: [
    GoRoute(
      path: '/chat',
      builder: (context, state) => const ChatPage(),
    ),
    GoRoute(
      path: '/agents',
      builder: (context, state) => const AgentsPage(),
    ),
    GoRoute(
      path: '/agents/:id',
      builder: (context, state) => AgentDetailPage(
        agentId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsPage(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingPage(),
    ),
  ],
);
