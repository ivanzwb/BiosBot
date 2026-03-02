import 'package:flutter/material.dart';

void main() {
  runApp(const CloudbrainApp());
}

class CloudbrainApp extends StatelessWidget {
  const CloudbrainApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cloudbrain',
      home: Scaffold(
        appBar: AppBar(title: const Text('Cloudbrain 前端')),
        body: const Center(child: Text('Cloudbrain Flutter 前端已启动')),
      ),
    );
  }
}
