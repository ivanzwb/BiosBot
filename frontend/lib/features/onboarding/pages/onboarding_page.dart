import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// 首次使用引导页面
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  int _currentStep = 0;

  final _steps = const [
    _OnboardingStep(
      icon: Icons.key,
      title: '配置 API Key',
      description: '前往设置页面，填入你的 API Key 和 API URL，Agent 才能正常工作。所有模型均通过 OpenAI 兼容接口调用。',
    ),
    _OnboardingStep(
      icon: Icons.smart_toy,
      title: '了解 Agent',
      description: 'CloudBrain 内置多个领域 Agent（股票分析、题目讲解、小说创作、影视推荐等），你可以在 Agent 管理页面查看和配置。',
    ),
    _OnboardingStep(
      icon: Icons.chat,
      title: '开始对话',
      description: '创建新对话，输入你的问题，代理 Agent 会自动识别意图并调用合适的领域 Agent 为你解答。',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final step = _steps[_currentStep];
    final isLast = _currentStep == _steps.length - 1;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Spacer(),
              Icon(
                step.icon,
                size: 80,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 32),
              Text(
                step.title,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                step.description,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              // 步骤指示器
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _steps.length,
                  (i) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _currentStep ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _currentStep
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context)
                              .colorScheme
                              .primary
                              .withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: () => context.go('/chat'),
                    child: const Text('跳过'),
                  ),
                  FilledButton(
                    onPressed: () {
                      if (isLast) {
                        context.go('/chat');
                      } else {
                        setState(() => _currentStep++);
                      }
                    },
                    child: Text(isLast ? '开始使用' : '下一步'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingStep {
  final IconData icon;
  final String title;
  final String description;
  const _OnboardingStep({
    required this.icon,
    required this.title,
    required this.description,
  });
}
