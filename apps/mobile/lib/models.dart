typedef PlayerId = String; // 'p1' | 'p2'
typedef CardType = String; // monster | spell | trap
typedef ElementType = String;
typedef Position = String; // attack | defense
typedef Phase = String; // draw | main | battle | end

class CardDef {
  CardDef({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.type,
    this.element,
    this.level,
    this.atk,
    this.def,
    this.tags,
    required this.textAr,
    this.textEn,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final CardType type;
  final ElementType? element;
  final int? level;
  final int? atk;
  final int? def;
  final List<String>? tags;
  final String textAr;
  final String? textEn;

  factory CardDef.fromJson(Map<String, dynamic> json) {
    return CardDef(
      id: json['id'] as String,
      nameAr: json['nameAr'] as String,
      nameEn: json['nameEn'] as String? ?? '',
      type: json['type'] as String,
      element: json['element'] as String?,
      level: (json['level'] as num?)?.toInt(),
      atk: (json['atk'] as num?)?.toInt(),
      def: (json['def'] as num?)?.toInt(),
      tags: (json['tags'] as List<dynamic>?)?.cast<String>(),
      textAr: json['textAr'] as String,
      textEn: json['textEn'] as String?,
    );
  }
}

class FieldMonster {
  FieldMonster({
    required this.instanceId,
    required this.cardId,
    required this.position,
    required this.atkBuff,
    required this.defBuff,
    required this.canAttack,
    required this.faceUp,
  });

  final String instanceId;
  final String cardId;
  final Position position;
  final int atkBuff;
  final int defBuff;
  final bool canAttack;
  final bool faceUp;

  factory FieldMonster.fromJson(Map<String, dynamic> json) {
    return FieldMonster(
      instanceId: json['instanceId'] as String,
      cardId: json['cardId'] as String,
      position: json['position'] as String,
      atkBuff: (json['atkBuff'] as num?)?.toInt() ?? 0,
      defBuff: (json['defBuff'] as num?)?.toInt() ?? 0,
      canAttack: json['canAttack'] as bool? ?? false,
      faceUp: json['faceUp'] as bool? ?? true,
    );
  }
}

class FieldSpellTrap {
  FieldSpellTrap({
    required this.instanceId,
    required this.cardId,
    required this.faceUp,
    required this.setThisTurn,
  });

  final String instanceId;
  final String cardId;
  final bool faceUp;
  final bool setThisTurn;

  factory FieldSpellTrap.fromJson(Map<String, dynamic> json) {
    return FieldSpellTrap(
      instanceId: json['instanceId'] as String,
      cardId: json['cardId'] as String,
      faceUp: json['faceUp'] as bool? ?? false,
      setThisTurn: json['setThisTurn'] as bool? ?? false,
    );
  }
}

class PublicPlayerView {
  PublicPlayerView({
    required this.id,
    required this.life,
    required this.deckCount,
    required this.handCount,
    this.hand,
    required this.graveyard,
    required this.monsters,
    required this.spellTraps,
    required this.normalSummonUsed,
  });

  final PlayerId id;
  final int life;
  final int deckCount;
  final int handCount;
  final List<String>? hand;
  final List<String> graveyard;
  final List<FieldMonster?> monsters;
  final List<FieldSpellTrap?> spellTraps;
  final bool normalSummonUsed;

  factory PublicPlayerView.fromJson(Map<String, dynamic> json) {
    return PublicPlayerView(
      id: json['id'] as String,
      life: (json['life'] as num).toInt(),
      deckCount: (json['deckCount'] as num).toInt(),
      handCount: (json['handCount'] as num).toInt(),
      hand: (json['hand'] as List<dynamic>?)?.cast<String>(),
      graveyard: (json['graveyard'] as List<dynamic>).cast<String>(),
      monsters: (json['monsters'] as List<dynamic>)
          .map((e) => e == null ? null : FieldMonster.fromJson(e as Map<String, dynamic>))
          .toList(),
      spellTraps: (json['spellTraps'] as List<dynamic>)
          .map((e) => e == null ? null : FieldSpellTrap.fromJson(e as Map<String, dynamic>))
          .toList(),
      normalSummonUsed: json['normalSummonUsed'] as bool? ?? false,
    );
  }
}

class PendingTarget {
  PendingTarget({
    required this.playerId,
    this.sourceInstanceId,
    required this.sourceCardId,
    required this.effectIndex,
    required this.reason,
  });

  final PlayerId playerId;
  final String? sourceInstanceId;
  final String sourceCardId;
  final int effectIndex;
  final String reason;

  factory PendingTarget.fromJson(Map<String, dynamic> json) {
    return PendingTarget(
      playerId: json['playerId'] as String,
      sourceInstanceId: json['sourceInstanceId'] as String?,
      sourceCardId: json['sourceCardId'] as String,
      effectIndex: (json['effectIndex'] as num).toInt(),
      reason: json['reason'] as String,
    );
  }
}

class PublicGameView {
  PublicGameView({
    required this.matchId,
    required this.you,
    required this.turn,
    required this.phase,
    required this.turnNumber,
    required this.winner,
    required this.log,
    required this.players,
    this.pendingTarget,
  });

  final String matchId;
  final PlayerId you;
  final PlayerId turn;
  final Phase phase;
  final int turnNumber;
  final PlayerId? winner;
  final List<String> log;
  final Map<PlayerId, PublicPlayerView> players;
  final PendingTarget? pendingTarget;

  PlayerId get opponent => you == 'p1' ? 'p2' : 'p1';

  PublicPlayerView get yourPlayer => players[you]!;
  PublicPlayerView get opponentPlayer => players[opponent]!;

  bool get isYourTurn => turn == you;

  factory PublicGameView.fromJson(Map<String, dynamic> json) {
    final rawPlayers = json['players'] as Map<String, dynamic>;
    return PublicGameView(
      matchId: json['matchId'] as String,
      you: json['you'] as String,
      turn: json['turn'] as String,
      phase: json['phase'] as String,
      turnNumber: (json['turnNumber'] as num).toInt(),
      winner: json['winner'] as String?,
      log: (json['log'] as List<dynamic>).cast<String>(),
      players: rawPlayers.map(
        (k, v) => MapEntry(k, PublicPlayerView.fromJson(v as Map<String, dynamic>)),
      ),
      pendingTarget: json['pendingTarget'] == null
          ? null
          : PendingTarget.fromJson(json['pendingTarget'] as Map<String, dynamic>),
    );
  }
}

class JoinedPayload {
  JoinedPayload({required this.code, required this.you, required this.mode});

  final String code;
  final PlayerId you;
  final String mode;

  factory JoinedPayload.fromJson(Map<String, dynamic> json) {
    return JoinedPayload(
      code: json['code'] as String,
      you: json['you'] as String,
      mode: json['mode'] as String,
    );
  }
}

/// Typed game actions matching server `GameAction`.
abstract class GameAction {
  Map<String, dynamic> toJson();

  factory GameAction.draw() = DrawAction;

  factory GameAction.summon({
    required int handIndex,
    required int zoneIndex,
    required Position position,
  }) = SummonAction;

  factory GameAction.setSpellTrap({
    required int handIndex,
    required int zoneIndex,
  }) = SetSpellTrapAction;

  factory GameAction.activateSpell({
    required int handIndex,
    int? zoneIndex,
    String? targetInstanceId,
  }) = ActivateSpellAction;

  factory GameAction.declareAttack({
    required int attackerZone,
    required Object targetZone,
  }) = DeclareAttackAction;

  factory GameAction.goPhase(Phase phase) = GoPhaseAction;

  factory GameAction.endTurn() = EndTurnAction;
}

class DrawAction implements GameAction {
  @override
  Map<String, dynamic> toJson() => {'type': 'draw'};
}

class SummonAction implements GameAction {
  SummonAction({
    required this.handIndex,
    required this.zoneIndex,
    required this.position,
  });

  final int handIndex;
  final int zoneIndex;
  final Position position;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'summon',
        'handIndex': handIndex,
        'zoneIndex': zoneIndex,
        'position': position,
      };
}

class SetSpellTrapAction implements GameAction {
  SetSpellTrapAction({required this.handIndex, required this.zoneIndex});

  final int handIndex;
  final int zoneIndex;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'set_spell_trap',
        'handIndex': handIndex,
        'zoneIndex': zoneIndex,
      };
}

class ActivateSpellAction implements GameAction {
  ActivateSpellAction({
    required this.handIndex,
    this.zoneIndex,
    this.targetInstanceId,
  });

  final int handIndex;
  final int? zoneIndex;
  final String? targetInstanceId;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'activate_spell',
        'handIndex': handIndex,
        if (zoneIndex != null) 'zoneIndex': zoneIndex,
        if (targetInstanceId != null) 'targetInstanceId': targetInstanceId,
      };
}

class DeclareAttackAction implements GameAction {
  DeclareAttackAction({required this.attackerZone, required this.targetZone});

  final int attackerZone;
  final Object targetZone; // int | 'player'

  @override
  Map<String, dynamic> toJson() => {
        'type': 'declare_attack',
        'attackerZone': attackerZone,
        'targetZone': targetZone,
      };
}

class GoPhaseAction implements GameAction {
  GoPhaseAction(this.phase);

  final Phase phase;

  @override
  Map<String, dynamic> toJson() => {'type': 'go_phase', 'phase': phase};
}

class EndTurnAction implements GameAction {
  @override
  Map<String, dynamic> toJson() => {'type': 'end_turn'};
}
