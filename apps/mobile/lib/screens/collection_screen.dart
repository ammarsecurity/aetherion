import 'package:flutter/material.dart';

import '../models.dart';
import '../socket_service.dart';
import '../theme.dart';
import '../widgets/card_widget.dart';

class CollectionScreen extends StatefulWidget {
  const CollectionScreen({super.key});

  @override
  State<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends State<CollectionScreen> {
  final _svc = socketService;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _svc.addListener(_refresh);
    _loadIfNeeded();
  }

  @override
  void dispose() {
    _svc.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

  Future<void> _loadIfNeeded() async {
    if (_svc.cards.isNotEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (!_svc.connected) _svc.connect();
      await Future<void>.delayed(const Duration(milliseconds: 400));
      if (_svc.cards.isEmpty) {
        await _svc.fetchCardsRest();
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = _svc.cards;

    return Scaffold(
      appBar: AppBar(title: const Text('المجموعة')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AetherionColors.accent))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _loadIfNeeded, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.62,
                  ),
                  itemCount: cards.length,
                  itemBuilder: (context, i) {
                    final card = cards[i];
                    return GestureDetector(
                      onTap: () => _showDetail(card),
                      child: CardWidget(card: card, compact: false),
                    );
                  },
                ),
    );
  }

  void _showDetail(CardDef card) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AetherionColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(card.nameAr, style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(card.textAr, style: const TextStyle(color: AetherionColors.textMuted, height: 1.4)),
              if (card.type == 'monster') ...[
                const SizedBox(height: 12),
                Text('هجوم ${card.atk} — دفاع ${card.def}', style: const TextStyle(color: AetherionColors.gold)),
              ],
            ],
          ),
        );
      },
    );
  }
}
