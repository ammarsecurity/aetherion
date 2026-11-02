import 'package:flutter/material.dart';

import '../api_service.dart';
import '../theme.dart';
import 'auth_screen.dart';

class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key});

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  final _api = apiService;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _api.addListener(_refresh);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

  Future<void> _load() async {
    if (!_api.isLoggedIn) return;
    setState(() => _loading = true);
    try {
      await _api.refreshAccountData();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openAuth() async {
    await Navigator.of(context).push<void>(MaterialPageRoute<void>(builder: (_) => const AuthScreen()));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final progress = _api.progress;
    final activeDeck = _api.decks.where((d) => d.isActive).firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('التقدم')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: !_api.isLoggedIn
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('سجّل دخولك لتتبع انتصاراتك وXP.', style: TextStyle(color: AetherionColors.textMuted)),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _openAuth, child: const Text('تسجيل الدخول')),
                  ],
                )
              : _loading && progress == null
                  ? const Center(child: CircularProgressIndicator(color: AetherionColors.accent))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _api.user!.displayName,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          '@${_api.user!.username}',
                          style: const TextStyle(color: AetherionColors.textMuted),
                        ),
                        const SizedBox(height: 24),
                        _StatGrid(
                          wins: progress?.wins ?? 0,
                          losses: progress?.losses ?? 0,
                          xp: progress?.xp ?? 0,
                          matches: progress?.matchesPlayed ?? 0,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'المجموعة النشطة: ${activeDeck?.name ?? 'الافتراضية'}',
                          style: const TextStyle(color: AetherionColors.textMuted),
                        ),
                        const Spacer(),
                        OutlinedButton(onPressed: _load, child: const Text('تحديث')),
                      ],
                    ),
        ),
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({
    required this.wins,
    required this.losses,
    required this.xp,
    required this.matches,
  });

  final int wins;
  final int losses;
  final int xp;
  final int matches;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossCount = constraints.maxWidth > 400 ? 4 : 2;
        return GridView.count(
          crossAxisCount: crossCount,
          shrinkWrap: true,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.4,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _StatTile(value: wins, label: 'فوز'),
            _StatTile(value: losses, label: 'خسارة'),
            _StatTile(value: xp, label: 'XP'),
            _StatTile(value: matches, label: 'مباريات'),
          ],
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AetherionColors.surfaceHigh,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$value',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AetherionColors.accent),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 13, color: AetherionColors.textMuted)),
        ],
      ),
    );
  }
}
