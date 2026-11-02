import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

Color elementColor(String? element) {
  switch (element) {
    case 'shadow':
      return const Color(0xFF7C3AED);
    case 'light':
      return const Color(0xFFFBBF24);
    case 'flame':
      return const Color(0xFFEF4444);
    case 'tide':
      return const Color(0xFF3B82F6);
    case 'stone':
      return const Color(0xFF78716C);
    case 'aether':
      return AetherionColors.accent;
    default:
      return AetherionColors.surfaceHigh;
  }
}

String typeLabelAr(CardType type) {
  switch (type) {
    case 'monster':
      return 'وحش';
    case 'spell':
      return 'تعويذة';
    case 'trap':
      return 'فخ';
    default:
      return type;
  }
}

class CardWidget extends StatelessWidget {
  const CardWidget({
    super.key,
    required this.card,
    this.compact = false,
    this.faceDown = false,
    this.onTap,
    this.selected = false,
    this.subtitle,
  });

  final CardDef? card;
  final bool compact;
  final bool faceDown;
  final VoidCallback? onTap;
  final bool selected;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected ? AetherionColors.gold : AetherionColors.accent.withValues(alpha: 0.35);

    if (faceDown || card == null) {
      return _CardShell(
        onTap: onTap,
        borderColor: borderColor,
        compact: compact,
        child: Center(
          child: Icon(Icons.auto_awesome, color: AetherionColors.gold.withValues(alpha: 0.7), size: compact ? 20 : 28),
        ),
      );
    }

    final c = card!;
    final el = elementColor(c.element);

    return _CardShell(
      onTap: onTap,
      borderColor: borderColor,
      compact: compact,
      accent: el,
      child: Padding(
        padding: EdgeInsets.all(compact ? 6 : 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (c.level != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AetherionColors.gold.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('★${c.level}', style: TextStyle(fontSize: compact ? 9 : 11, color: AetherionColors.gold)),
                  ),
                const Spacer(),
                Text(typeLabelAr(c.type), style: TextStyle(fontSize: compact ? 8 : 10, color: AetherionColors.textMuted)),
              ],
            ),
            SizedBox(height: compact ? 2 : 4),
            Text(
              c.nameAr,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: compact ? 10 : 12,
                fontWeight: FontWeight.w700,
                color: AetherionColors.textPrimary,
                height: 1.1,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(subtitle!, style: TextStyle(fontSize: compact ? 8 : 9, color: AetherionColors.accent)),
            ],
            const Spacer(),
            if (c.type == 'monster')
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _StatChip(label: 'هج', value: c.atk ?? 0, compact: compact),
                  _StatChip(label: 'دف', value: c.def ?? 0, compact: compact),
                ],
              )
            else if (!compact)
              Text(
                c.textAr,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 9, color: AetherionColors.textMuted, height: 1.2),
              ),
          ],
        ),
      ),
    );
  }
}

class _CardShell extends StatelessWidget {
  const _CardShell({
    required this.child,
    required this.borderColor,
    required this.compact,
    this.accent,
    this.onTap,
  });

  final Widget child;
  final Color borderColor;
  final bool compact;
  final Color? accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AetherionColors.surface,
      borderRadius: BorderRadius.circular(compact ? 8 : 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(compact ? 8 : 10),
        child: Container(
          width: compact ? 72 : 100,
          height: compact ? 96 : 140,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(compact ? 8 : 10),
            border: Border.all(color: borderColor, width: selectedWidth(borderColor)),
            gradient: LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [
                (accent ?? AetherionColors.surfaceHigh).withValues(alpha: 0.35),
                AetherionColors.surface,
              ],
            ),
          ),
          child: child,
        ),
      ),
    );
  }

  double selectedWidth(Color c) => c == AetherionColors.gold ? 2.5 : 1;
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value, required this.compact});

  final String label;
  final int value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label $value',
      style: TextStyle(fontSize: compact ? 9 : 10, fontWeight: FontWeight.w600, color: AetherionColors.textPrimary),
    );
  }
}

class FieldMonsterWidget extends StatelessWidget {
  const FieldMonsterWidget({
    super.key,
    required this.monster,
    required this.card,
    this.onTap,
    this.highlight = false,
    this.compact = true,
  });

  final FieldMonster? monster;
  final CardDef? card;
  final VoidCallback? onTap;
  final bool highlight;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (monster == null) {
      return Container(
        width: compact ? 72 : 88,
        height: compact ? 96 : 112,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AetherionColors.surfaceHigh, width: 1.5),
        ),
        child: const Center(child: Icon(Icons.add, color: AetherionColors.textMuted, size: 18)),
      );
    }

    final def = card;
    final atk = (def?.atk ?? 0) + monster!.atkBuff;
    final defVal = (def?.def ?? 0) + monster!.defBuff;
    final pos = monster!.position == 'attack' ? 'هج' : 'دف';

    return CardWidget(
      card: def,
      compact: compact,
      faceDown: !monster!.faceUp,
      selected: highlight,
      onTap: onTap,
      subtitle: monster!.faceUp ? '$pos $atk/$defVal' : null,
    );
  }
}
