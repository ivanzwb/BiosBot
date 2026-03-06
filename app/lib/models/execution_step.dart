/// 执行步骤类型
enum StepType {
  classify,    // 意图识别
  route,       // 路由规划
  agentStart,  // 开始调用领域Agent
  agentEnd,    // 领域Agent完成
  toolCall,    // 工具调用
  aggregate,   // 聚合结果
  directAnswer // 直接回答
}

/// 执行步骤状态
enum StepStatus {
  running,
  completed,
  failed
}

/// 执行步骤模型
class ExecutionStep {
  final StepType stepType;
  final String? agentId;
  final String? agentName;
  final String description;
  final StepStatus status;
  final dynamic detail;
  final DateTime timestamp;

  ExecutionStep({
    required this.stepType,
    this.agentId,
    this.agentName,
    required this.description,
    required this.status,
    this.detail,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  factory ExecutionStep.fromJson(Map<String, dynamic> json) {
    return ExecutionStep(
      stepType: _parseStepType(json['stepType'] as String),
      agentId: json['agentId'] as String?,
      agentName: json['agentName'] as String?,
      description: json['description'] as String,
      status: _parseStepStatus(json['status'] as String),
      detail: json['detail'],
    );
  }

  static StepType _parseStepType(String type) {
    switch (type) {
      case 'classify':
        return StepType.classify;
      case 'route':
        return StepType.route;
      case 'agent_start':
        return StepType.agentStart;
      case 'agent_end':
        return StepType.agentEnd;
      case 'tool_call':
        return StepType.toolCall;
      case 'aggregate':
        return StepType.aggregate;
      case 'direct_answer':
        return StepType.directAnswer;
      default:
        return StepType.classify;
    }
  }

  static StepStatus _parseStepStatus(String status) {
    switch (status) {
      case 'running':
        return StepStatus.running;
      case 'completed':
        return StepStatus.completed;
      case 'failed':
        return StepStatus.failed;
      default:
        return StepStatus.running;
    }
  }

  /// 获取步骤类型的图标
  String get icon {
    switch (stepType) {
      case StepType.classify:
        return '🔍';
      case StepType.route:
        return '🗂️';
      case StepType.agentStart:
      case StepType.agentEnd:
        return '🤖';
      case StepType.toolCall:
        return '⚙️';
      case StepType.aggregate:
        return '📊';
      case StepType.directAnswer:
        return '💬';
    }
  }

  /// 是否是正在运行的步骤
  bool get isRunning => status == StepStatus.running;

  /// 是否已完成
  bool get isCompleted => status == StepStatus.completed;

  /// 是否失败
  bool get isFailed => status == StepStatus.failed;
}
