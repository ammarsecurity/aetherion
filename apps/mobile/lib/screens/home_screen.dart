import 'package:flutter/material.dart';

import '../api_service.dart';
import '../socket_service.dart';
import '../theme.dart';
import 'auth_screen.dart';
import 'battle_screen.dart';
import 'collection_screen.dart';
import 'decks_screen.dart';
import 'progress_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.autoConnect = true});

  final bool autoConnect;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _svc = socketService;
  final _api = apiService;
  final _codeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.autoConnect) _svc.connect();
    _svc.addListener(_onSocket);
    _api.addListener(_onAccount);
  }

  @override
  void dispose() {
    _svc.removeListener(_onSocket);
    _api.removeListener(_onAccount);
    _codeController.dispose();
    super.dispose();
  }

  void _onAccount() {
    if (mounted) setState(() {});
  }

  void _onSocket() {
    if (!mounted) return;
    if (_svc.lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_svc.lastError!)),
      );
      _svc.clearError();
    }
    final joined = _svc.takeJoined();
    if (joined != null) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => BattleScreen(roomCode: joined.code, mode: joined.mode),
        ),
      );
    }
    setState(() {});
  }

  Future<void> _showJoinDialog() async {
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AetherionColors.surface,
          title: const Text('انضمام للمباراة'),
          content: TextField(
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(hintText: 'رمز الغرفة'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                _svc.joinPvp(_codeController.text);
              },
              child: const Text('انضمام'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showServerSettings() async {
    final hostCtrl = TextEditingController(text: aetherionServerHost);
    final portCtrl = TextEditingController(text: '$aetherionServerPort');
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AetherionColors.surface,
          title: const Text('إعدادات الخادم'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: hostCtrl,
                decoration: const InputDecoration(labelText: 'المضيف (localhost / 10.0.2.2)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: portCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'المنفذ'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
            FilledButton(
              onPressed: () {
                aetherionServerHost = hostCtrl.text.trim().isEmpty ? aetherionServerHost : hostCtrl.text.trim();
                aetherionServerPort = int.tryParse(portCtrl.text.trim()) ?? aetherionServerPort;
                _svc.reconnectWithAuth();
                Navigator.pop(ctx);
                setState(() {});
              },
              child: const Text('حفظ'),
            ),
          ],
        );
      },
    );
    hostCtrl.dispose();
    portCtrl.dispose();
  }

  Future<void> _openAuth() async {
    await Navigator.of(context).push<void>(MaterialPageRoute<void>(builder: (_) => const AuthScreen()));
    if (_api.isLoggedIn) _svc.reconnectWithAuth();
  }

  Future<void> _logout() async {
    await _api.logout();
    _svc.reconnectWithAuth();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('أثيريون'),
        actions: [
          if (_api.isLoggedIn)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 4),
              child: Center(
                child: Text(
                  '${_api.user!.displayName} · ${_api.progress?.wins ?? 0} فوز',
                  style: const TextStyle(fontSize: 12, color: AetherionColors.textMuted),
                ),
              ),
            )
          else
            TextButton(onPressed: _openAuth, child: const Text('حسابي')),
          if (_api.isLoggedIn)
            IconButton(
              tooltip: 'خروج',
              onPressed: _logout,
              icon: const Icon(Icons.logout, size: 20),
            ),
          IconButton(
            tooltip: 'إعدادات الخادم',
            onPressed: _showServerSettings,
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const Spacer(flex: 2),
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [AetherionColors.gold, AetherionColors.accent],
                ).createShader(bounds),
                child: Text(
                  'أثيريون',
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'معركة البطاقات العربية',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AetherionColors.textMuted),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _svc.connected ? Icons.circle : Icons.circle_outlined,
                    size: 10,
                    color: _svc.connected ? AetherionColors.accent : AetherionColors.danger,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      _svc.connected ? 'متصل — $aetherionServerUrl' : 'غير متصل',
                      style: const TextStyle(fontSize: 12, color: AetherionColors.textMuted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const Spacer(flex: 3),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _svc.connected ? _svc.createAi : null,
                  child: const Text('ضد الكمبيوتر'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _svc.connected ? _svc.createPvp : null,
                  child: const Text('أونلاين — إنشاء غرفة'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _svc.connected ? _showJoinDialog : null,
                  child: const Text('أونلاين — انضم برمز'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const DecksScreen()),
                    );
                  },
                  child: const Text('مجموعاتي'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const CollectionScreen()),
                    );
                  },
                  child: const Text('الكتالوج'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const ProgressScreen()),
                    );
                  },
                  child: const Text('التقدم'),
                ),
              ),
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}
