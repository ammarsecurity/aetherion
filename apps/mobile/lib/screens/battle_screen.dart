import 'package:flutter/material.dart';

import '../api_service.dart';
import '../models.dart';
import '../socket_service.dart';
import '../theme.dart';
import '../widgets/card_widget.dart';

class BattleScreen extends StatefulWidget {
  const BattleScreen({super.key, required this.roomCode, required this.mode});

  final String roomCode;
  final String mode;

  @override
  State<BattleScreen> createState() => _BattleScreenState();
}

class _BattleScreenState extends State<BattleScreen> {
  final _svc = socketService;

  int? _selectedHandIndex;
  int? _attackerZone;
  bool _attackMode = false;
  bool _summonMode = false;

  @override
  void initState() {
    super.initState();
    _svc.addListener(_onUpdate);
  }

  @override
  void dispose() {
    _svc.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    if (!mounted) return;
    if (_svc.lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_svc.lastError!)));
      _svc.clearError();
    }
    if (_svc.gameOverWinner != null) {
      final you = _svc.gameState?.you;
      final won = _svc.gameOverWinner == you;
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: AetherionColors.surface,
          title: Text(won ? 'انتصرت!' : 'انتهت المباراة'),
          content: Text(won ? 'أحسنت!' : 'حظاً أوفر في المرة القادمة'),
          actions: [
            FilledButton(
              onPressed: () {
                _svc.gameOverWinner = null;
                if (apiService.isLoggedIn) {
                  apiService.refreshAccountData();
                }
                Navigator.of(ctx).pop();
                Navigator.of(context).pop();
              },
              child: const Text('العودة'),
            ),
          ],
        ),
      );
    }
    setState(() {});
  }

  PublicGameView? get _state => _svc.gameState;

  String _phaseAr(Phase p) {
    switch (p) {
      case 'draw':
        return 'سحب';
      case 'main':
        return 'رئيسية';
      case 'battle':
        return 'قتال';
      case 'end':
        return 'نهاية';
      default:
        return p;
    }
  }

  void _resetSelection() {
    _selectedHandIndex = null;
    _attackerZone = null;
    _attackMode = false;
    _summonMode = false;
  }

  Future<Position?> _pickPosition() async {
    return showDialog<Position>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AetherionColors.surface,
        title: const Text('وضعية الوحش'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'attack'),
            child: const Text('هجوم'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'defense'),
            child: const Text('دفاع'),
          ),
        ],
      ),
    );
  }

  void _onHandTap(int index, PublicGameView state) {
    if (!state.isYourTurn) return;
    final hand = state.yourPlayer.hand;
    if (hand == null || index >= hand.length) return;
    final cardId = hand[index];
    final def = _svc.def(cardId);

    if (_summonMode && def?.type == 'monster' && state.phase == 'main') {
      _selectedHandIndex = index;
      setState(() {});
      return;
    }

    if (def?.type == 'spell' && state.phase == 'main') {
      _svc.sendAction(GameAction.activateSpell(handIndex: index));
      _resetSelection();
      setState(() {});
      return;
    }

    setState(() => _selectedHandIndex = index);
  }

  Future<void> _onMonsterZoneTap(int zoneIndex, PublicGameView state, {required bool yours}) async {
    if (!state.isYourTurn) return;

    if (_attackMode && yours) {
      final m = state.yourPlayer.monsters[zoneIndex];
      if (m != null && m.canAttack && m.faceUp) {
        setState(() => _attackerZone = zoneIndex);
      }
      return;
    }

    if (!yours && _attackMode && _attackerZone != null) {
      _svc.sendAction(GameAction.declareAttack(attackerZone: _attackerZone!, targetZone: zoneIndex));
      _resetSelection();
      setState(() {});
      return;
    }

    if (yours && _summonMode && _selectedHandIndex != null && state.phase == 'main') {
      final hand = state.yourPlayer.hand!;
      final def = _svc.def(hand[_selectedHandIndex!]);
      if (def?.type != 'monster') return;
      if (state.yourPlayer.monsters[zoneIndex] != null) return;
      final pos = await _pickPosition();
      if (pos == null) return;
      _svc.sendAction(GameAction.summon(
        handIndex: _selectedHandIndex!,
        zoneIndex: zoneIndex,
        position: pos,
      ));
      _resetSelection();
      setState(() {});
      return;
    }

    if (yours && _selectedHandIndex != null && state.phase == 'main') {
      final hand = state.yourPlayer.hand!;
      final def = _svc.def(hand[_selectedHandIndex!]);
      if (def?.type == 'spell' || def?.type == 'trap') {
        if (state.yourPlayer.spellTraps[zoneIndex] != null) return;
        if (def!.type == 'spell') {
          _svc.sendAction(GameAction.activateSpell(handIndex: _selectedHandIndex!, zoneIndex: zoneIndex));
        } else {
          _svc.sendAction(GameAction.setSpellTrap(handIndex: _selectedHandIndex!, zoneIndex: zoneIndex));
        }
        _resetSelection();
        setState(() {});
      }
    }
  }

  void _directAttack(PublicGameView state) {
    if (_attackerZone == null || !state.isYourTurn || state.phase != 'battle') return;
    _svc.sendAction(GameAction.declareAttack(attackerZone: _attackerZone!, targetZone: 'player'));
    _resetSelection();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    if (state == null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.roomCode)),
        body: const Center(child: CircularProgressIndicator(color: AetherionColors.accent)),
      );
    }

    final you = state.yourPlayer;
    final opp = state.opponentPlayer;

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.roomCode} · ${widget.mode == 'ai' ? 'ضد AI' : 'أونلاين'}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          _LifeBar(label: 'الخصم', life: opp.life, deck: opp.deckCount, alignEnd: true),
          if (widget.mode == 'pvp' && !_svc.opponentJoined)
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text('بانتظار انضمام الخصم…', style: TextStyle(color: AetherionColors.gold)),
            ),
          Expanded(
            flex: 4,
            child: _FieldSection(
              label: 'حقل الخصم',
              monsters: opp.monsters,
              spellTraps: opp.spellTraps,
              svc: _svc,
              onMonsterTap: (i) => _onMonsterZoneTap(i, state, yours: false),
              attackerSelected: _attackerZone,
              attackMode: _attackMode,
            ),
          ),
          _PhaseStrip(state: state, phaseAr: _phaseAr(state.phase)),
          Expanded(
            flex: 4,
            child: _FieldSection(
              label: 'حقلك',
              monsters: you.monsters,
              spellTraps: you.spellTraps,
              svc: _svc,
              onMonsterTap: (i) => _onMonsterZoneTap(i, state, yours: true),
              attackerSelected: _attackerZone,
              attackMode: _attackMode,
              yours: true,
            ),
          ),
          _LifeBar(label: 'أنت', life: you.life, deck: you.deckCount, alignEnd: false),
          if (state.log.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Text(
                state.log.last,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AetherionColors.textMuted),
              ),
            ),
          SizedBox(
            height: 108,
            child: you.hand == null
                ? Center(child: Text('(${you.handCount} بطاقة)', style: const TextStyle(color: AetherionColors.textMuted)))
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    itemCount: you.hand!.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 6),
                    itemBuilder: (context, i) {
                      final id = you.hand![i];
                      return CardWidget(
                        card: _svc.def(id),
                        compact: true,
                        selected: _selectedHandIndex == i,
                        onTap: () => _onHandTap(i, state),
                      );
                    },
                  ),
          ),
          _ActionBar(
            state: state,
            attackMode: _attackMode,
            summonMode: _summonMode,
            onDraw: () {
              _svc.sendAction(GameAction.draw());
              setState(() {});
            },
            onSummonMode: () {
              setState(() {
                _summonMode = !_summonMode;
                _attackMode = false;
                _selectedHandIndex = null;
              });
            },
            onActivateSpell: () {
              if (_selectedHandIndex == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('اختر تعويذة من يدك')),
                );
                return;
              }
              _svc.sendAction(GameAction.activateSpell(handIndex: _selectedHandIndex!));
              _resetSelection();
              setState(() {});
            },
            onBattlePhase: () {
              _svc.sendAction(GameAction.goPhase('battle'));
              setState(() {
                _attackMode = true;
                _summonMode = false;
              });
            },
            onEndTurn: () {
              _svc.sendAction(GameAction.endTurn());
              _resetSelection();
              setState(() {});
            },
            onDirectAttack: () => _directAttack(state),
            canDirect: _attackMode && _attackerZone != null && state.phase == 'battle',
          ),
        ],
      ),
    );
  }
}

class _LifeBar extends StatelessWidget {
  const _LifeBar({
    required this.label,
    required this.life,
    required this.deck,
    required this.alignEnd,
  });

  final String label;
  final int life;
  final int deck;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        mainAxisAlignment: alignEnd ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: AetherionColors.gold)),
          const SizedBox(width: 12),
          _Chip(text: '❤ $life'),
          const SizedBox(width: 8),
          _Chip(text: '🃏 $deck'),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AetherionColors.surfaceHigh,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text, style: const TextStyle(fontSize: 13)),
    );
  }
}

class _PhaseStrip extends StatelessWidget {
  const _PhaseStrip({required this.state, required this.phaseAr});

  final PublicGameView state;
  final String phaseAr;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      color: AetherionColors.surface,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('الدور ${state.turnNumber}', style: const TextStyle(color: AetherionColors.textMuted)),
          Text(
            state.isYourTurn ? 'دورك · $phaseAr' : 'دور الخصم · $phaseAr',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: state.isYourTurn ? AetherionColors.accent : AetherionColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldSection extends StatelessWidget {
  const _FieldSection({
    required this.label,
    required this.monsters,
    required this.spellTraps,
    required this.svc,
    required this.onMonsterTap,
    required this.attackerSelected,
    required this.attackMode,
    this.yours = false,
  });

  final String label;
  final List<FieldMonster?> monsters;
  final List<FieldSpellTrap?> spellTraps;
  final SocketService svc;
  final void Function(int index) onMonsterTap;
  final int? attackerSelected;
  final bool attackMode;
  final bool yours;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AetherionColors.textMuted)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(5, (i) {
              final st = spellTraps.length > i ? spellTraps[i] : null;
              return _SpellZone(st: st, svc: svc);
            }),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(5, (i) {
              final m = monsters.length > i ? monsters[i] : null;
              return FieldMonsterWidget(
                monster: m,
                card: m == null ? null : svc.def(m.cardId),
                onTap: () => onMonsterTap(i),
                highlight: attackMode && yours && attackerSelected == i,
                compact: true,
              );
            }),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _SpellZone extends StatelessWidget {
  const _SpellZone({required this.st, required this.svc});

  final FieldSpellTrap? st;
  final SocketService svc;

  @override
  Widget build(BuildContext context) {
    if (st == null) {
      return Container(
        width: 56,
        height: 36,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AetherionColors.surfaceHigh),
        ),
      );
    }
    return SizedBox(
      width: 56,
      height: 36,
      child: CardWidget(
        card: svc.def(st!.cardId),
        compact: true,
        faceDown: !st!.faceUp,
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.state,
    required this.attackMode,
    required this.summonMode,
    required this.onDraw,
    required this.onSummonMode,
    required this.onActivateSpell,
    required this.onBattlePhase,
    required this.onEndTurn,
    required this.onDirectAttack,
    required this.canDirect,
  });

  final PublicGameView state;
  final bool attackMode;
  final bool summonMode;
  final VoidCallback onDraw;
  final VoidCallback onSummonMode;
  final VoidCallback onActivateSpell;
  final VoidCallback onBattlePhase;
  final VoidCallback onEndTurn;
  final VoidCallback onDirectAttack;
  final bool canDirect;

  @override
  Widget build(BuildContext context) {
    final enabled = state.isYourTurn && state.winner == null;

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
      decoration: const BoxDecoration(
        color: AetherionColors.surface,
        border: Border(top: BorderSide(color: AetherionColors.surfaceHigh)),
      ),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 6,
        runSpacing: 6,
        children: [
          if (state.phase == 'draw' && enabled)
            _MiniBtn(label: 'سحب', onPressed: onDraw),
          _MiniBtn(
            label: summonMode ? 'استدعاء ✓' : 'استدعاء',
            onPressed: enabled && state.phase == 'main' ? onSummonMode : null,
            active: summonMode,
          ),
          _MiniBtn(
            label: 'تفعيل تعويذة',
            onPressed: enabled && state.phase == 'main' ? onActivateSpell : null,
          ),
          _MiniBtn(
            label: attackMode ? 'قتال ✓' : 'قتال',
            onPressed: enabled ? onBattlePhase : null,
            active: attackMode,
          ),
          if (canDirect && enabled)
            _MiniBtn(label: 'هجوم مباشر', onPressed: onDirectAttack),
          _MiniBtn(
            label: 'إنهاء الدور',
            onPressed: enabled ? onEndTurn : null,
            primary: true,
          ),
        ],
      ),
    );
  }
}

class _MiniBtn extends StatelessWidget {
  const _MiniBtn({
    required this.label,
    required this.onPressed,
    this.active = false,
    this.primary = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool active;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final bg = primary
        ? AetherionColors.gold
        : active
            ? AetherionColors.accent.withValues(alpha: 0.25)
            : AetherionColors.surfaceHigh;
    final fg = primary ? AetherionColors.background : AetherionColors.textPrimary;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: onPressed == null ? AetherionColors.textMuted : fg),
          ),
        ),
      ),
    );
  }
}
