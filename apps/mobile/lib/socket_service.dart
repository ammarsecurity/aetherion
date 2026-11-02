import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_service.dart';
import 'models.dart';
import 'server_config.dart';

export 'server_config.dart';

class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  bool connected = false;

  List<CardDef> cards = [];
  final Map<String, CardDef> cardById = {};

  PublicGameView? gameState;
  JoinedPayload? joined;
  String? lastError;
  String? gameOverWinner;
  bool opponentJoined = false;

  void connect({String? tokenOverride}) {
    final token = tokenOverride ?? apiService.token;
    if (_socket != null) {
      if (token != null && token.isNotEmpty) {
        _socket!.emit('auth', {'token': token});
      }
      if (connected) return;
      return;
    }

    final builder = io.OptionBuilder()
        .setTransports(['websocket'])
        .enableAutoConnect()
        .enableForceNew();
    if (token != null && token.isNotEmpty) {
      builder.setAuth({'token': token});
    }

    _socket = io.io(aetherionServerUrl, builder.build());

    _socket!
      ..onConnect((_) {
        connected = true;
        final t = apiService.token;
        if (t != null && t.isNotEmpty) {
          _socket!.emit('auth', {'token': t});
        }
        notifyListeners();
      })
      ..onDisconnect((_) {
        connected = false;
        notifyListeners();
      })
      ..on('cards', (data) {
        _ingestCards(data);
        notifyListeners();
      })
      ..on('joined', (data) {
        joined = JoinedPayload.fromJson(Map<String, dynamic>.from(data as Map));
        opponentJoined = false;
        notifyListeners();
      })
      ..on('state', (data) {
        gameState = PublicGameView.fromJson(Map<String, dynamic>.from(data as Map));
        notifyListeners();
      })
      ..on('error_msg', (data) {
        final map = Map<String, dynamic>.from(data as Map);
        lastError = map['message'] as String? ?? 'خطأ';
        notifyListeners();
      })
      ..on('game_over', (data) {
        final map = Map<String, dynamic>.from(data as Map);
        gameOverWinner = map['winner'] as String?;
        notifyListeners();
      })
      ..on('opponent_joined', (_) {
        opponentJoined = true;
        notifyListeners();
      });
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    connected = false;
    gameState = null;
    joined = null;
    notifyListeners();
  }

  /// Reconnect socket so handshake auth reflects the current token.
  void reconnectWithAuth() {
    disconnect();
    connect();
  }

  void emitAuth(String token) {
    _socket?.emit('auth', {'token': token});
  }

  void clearError() {
    lastError = null;
    notifyListeners();
  }

  JoinedPayload? takeJoined() {
    final j = joined;
    joined = null;
    return j;
  }

  void createAi() {
    _socket?.emit('create_ai');
  }

  void createPvp() {
    _socket?.emit('create_pvp');
  }

  void joinPvp(String code) {
    _socket?.emit('join_pvp', {'code': code.trim().toUpperCase()});
  }

  void sendAction(GameAction action) {
    _socket?.emit('action', action.toJson());
  }

  Future<void> fetchCardsRest() async {
    final uri = Uri.parse('$aetherionServerUrl/api/cards');
    final res = await http.get(uri);
    if (res.statusCode != 200) {
      throw Exception('فشل تحميل البطاقات (${res.statusCode})');
    }
    final list = jsonDecode(res.body) as List<dynamic>;
    _ingestCards(list);
    notifyListeners();
  }

  void _ingestCards(dynamic data) {
    final list = data as List<dynamic>;
    cards = list.map((e) => CardDef.fromJson(Map<String, dynamic>.from(e as Map))).toList();
    cardById
      ..clear()
      ..addEntries(cards.map((c) => MapEntry(c.id, c)));
  }

  CardDef? def(String? cardId) => cardId == null ? null : cardById[cardId];
}

final socketService = SocketService();
