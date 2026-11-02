import 'package:flutter/material.dart';

import '../api_service.dart';
import '../socket_service.dart';
import '../theme.dart';
import '../widgets/card_widget.dart';
import 'auth_screen.dart';

class DecksScreen extends StatefulWidget {
  const DecksScreen({super.key});

  @override
  State<DecksScreen> createState() => _DecksScreenState();
}

class _DecksScreenState extends State<DecksScreen> {
  final _svc = socketService;
  final _api = apiService;
  final _nameCtrl = TextEditingController(text: 'مجموعتي');

  List<String> _selected = [];
  int? _editingId;
  bool _loadingCards = false;
  bool _saving = false;
  String? _error;
  String? _ok;

  @override
  void initState() {
    super.initState();
    _svc.addListener(_refresh);
    _api.addListener(_refresh);
    _bootstrap();
  }

  @override
  void dispose() {
    _svc.removeListener(_refresh);
    _api.removeListener(_refresh);
    _nameCtrl.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {});

  Map<String, int> get _counts {
    final map = <String, int>{};
    for (final id in _selected) {
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }

  Future<void> _bootstrap() async {
    setState(() => _loadingCards = true);
    try {
      if (!_svc.connected) _svc.connect();
      if (_svc.cards.isEmpty) {
        await _svc.fetchCardsRest();
      }
      if (_api.isLoggedIn && _api.decks.isEmpty) {
        await _api.refreshAccountData();
      }
      final active = _api.decks.where((d) => d.isActive).firstOrNull ?? _api.decks.firstOrNull;
      if (active != null) _loadDeck(active.id);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loadingCards = false);
    }
  }

  void _loadDeck(int id) {
    final d = _api.decks.where((x) => x.id == id).firstOrNull;
    if (d == null) return;
    setState(() {
      _editingId = d.id;
      _nameCtrl.text = d.name;
      _selected = [...d.cardIds];
      _error = null;
      _ok = null;
    });
  }

  void _newDeck() {
    setState(() {
      _editingId = null;
      _nameCtrl.text = 'مجموعتي';
      _selected = [];
      _error = null;
      _ok = null;
    });
  }

  void _addCard(String id) {
    if (_selected.length >= 40) return;
    if ((_counts[id] ?? 0) >= 3) return;
    setState(() => _selected = [..._selected, id]);
  }

  void _removeOne(String id) {
    final i = _selected.lastIndexOf(id);
    if (i < 0) return;
    final next = [..._selected];
    next.removeAt(i);
    setState(() => _selected = next);
  }

  Future<void> _openAuth() async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (_) => const AuthScreen()),
    );
    if (_api.isLoggedIn) await _api.refreshAccountData();
  }

  Future<void> _save({bool asActive = true}) async {
    if (!_api.isLoggedIn) {
      await _openAuth();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _ok = null;
    });
    try {
      await _api.saveDeck(
        id: _editingId,
        name: _nameCtrl.text.trim().isEmpty ? 'مجموعتي' : _nameCtrl.text.trim(),
        cardIds: _selected,
        isActive: asActive,
      );
      final active = _api.decks.where((d) => d.isActive).firstOrNull ?? _api.decks.firstOrNull;
      if (active != null) _editingId = active.id;
      setState(() => _ok = 'تم الحفظ');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _activate(int id) async {
    try {
      await _api.activateDeck(id);
      _loadDeck(id);
      setState(() => _ok = 'تم تفعيل المجموعة');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final counts = _counts;

    return Scaffold(
      appBar: AppBar(
        title: const Text('بناء المجموعة'),
        actions: [
          TextButton(onPressed: _newDeck, child: const Text('جديدة')),
        ],
      ),
      body: _loadingCards
          ? const Center(child: CircularProgressIndicator(color: AetherionColors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${_selected.length} / 40 · حد أقصى 3 لكل بطاقة',
                  style: const TextStyle(color: AetherionColors.textMuted),
                ),
                if (!_api.isLoggedIn) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Expanded(
                        child: Text('سجّل دخولك لحفظ المجموعة.', style: TextStyle(color: AetherionColors.gold)),
                      ),
                      TextButton(onPressed: _openAuth, child: const Text('دخول')),
                    ],
                  ),
                ],
                if (_api.decks.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final d in _api.decks)
                        OutlinedButton(
                          onPressed: () => _loadDeck(d.id),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: _editingId == d.id ? AetherionColors.accent : AetherionColors.surfaceHigh,
                            ),
                            foregroundColor: _editingId == d.id ? AetherionColors.accent : null,
                          ),
                          child: Text('${d.name}${d.isActive ? ' ★' : ''}'),
                        ),
                      if (_editingId != null)
                        OutlinedButton(onPressed: () => _activate(_editingId!), child: const Text('تفعيل')),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _nameCtrl,
                        decoration: const InputDecoration(hintText: 'اسم المجموعة'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _saving || _selected.length != 40 ? null : () => _save(asActive: true),
                      child: Text(_saving ? '...' : 'حفظ وتفعيل'),
                    ),
                  ],
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_error!, style: const TextStyle(color: AetherionColors.danger)),
                  ),
                if (_ok != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_ok!, style: const TextStyle(color: AetherionColors.accent)),
                  ),
                const SizedBox(height: 20),
                Text('المختارة', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AetherionColors.gold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final id in counts.keys)
                      ActionChip(
                        label: Text('${_svc.def(id)?.nameAr ?? id} ×${counts[id]}'),
                        onPressed: () => _removeOne(id),
                        backgroundColor: AetherionColors.surfaceHigh,
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                Text('الكتالوج', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AetherionColors.gold)),
                const SizedBox(height: 12),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.62,
                  ),
                  itemCount: _svc.cards.length,
                  itemBuilder: (context, i) {
                    final card = _svc.cards[i];
                    return Column(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => _addCard(card.id),
                            child: CardWidget(card: card, compact: true),
                          ),
                        ),
                        Text('${counts[card.id] ?? 0}/3', style: const TextStyle(fontSize: 11, color: AetherionColors.textMuted)),
                      ],
                    );
                  },
                ),
              ],
            ),
    );
  }
}
