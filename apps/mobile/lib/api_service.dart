import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'server_config.dart';

const _tokenKey = 'aetherion_token';

class AetherionUser {
  AetherionUser({
    required this.id,
    required this.username,
    required this.displayName,
  });

  final int id;
  final String username;
  final String displayName;

  factory AetherionUser.fromJson(Map<String, dynamic> json) {
    return AetherionUser(
      id: (json['id'] as num).toInt(),
      username: json['username'] as String,
      displayName: json['displayName'] as String? ?? json['username'] as String,
    );
  }
}

class SavedDeck {
  SavedDeck({
    required this.id,
    required this.name,
    required this.cardIds,
    required this.isActive,
    required this.updatedAt,
  });

  final int id;
  final String name;
  final List<String> cardIds;
  final bool isActive;
  final String updatedAt;

  factory SavedDeck.fromJson(Map<String, dynamic> json) {
    return SavedDeck(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      cardIds: (json['cardIds'] as List<dynamic>).cast<String>(),
      isActive: json['isActive'] as bool? ?? false,
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }
}

class PlayerProgress {
  PlayerProgress({
    required this.wins,
    required this.losses,
    required this.xp,
    required this.matchesPlayed,
    required this.updatedAt,
  });

  final int wins;
  final int losses;
  final int xp;
  final int matchesPlayed;
  final String updatedAt;

  factory PlayerProgress.fromJson(Map<String, dynamic> json) {
    return PlayerProgress(
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      xp: (json['xp'] as num?)?.toInt() ?? 0,
      matchesPlayed: (json['matchesPlayed'] as num?)?.toInt() ?? 0,
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiService extends ChangeNotifier {
  String? _token;
  AetherionUser? user;
  PlayerProgress? progress;
  List<SavedDeck> decks = [];

  String? get token => _token;
  bool get isLoggedIn => _token != null && user != null;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    if (_token != null) {
      try {
        final me = await meRequest();
        user = me;
        await refreshAccountData();
      } catch (_) {
        await clearSession();
      }
    }
    notifyListeners();
  }

  Future<void> _persistToken(String? value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value == null) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, value);
    }
    _token = value;
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<T> _request<T>(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    required T Function(Map<String, dynamic> json) parse,
  }) async {
    final uri = Uri.parse('$aetherionServerUrl$path');
    late http.Response res;
    final headers = await _headers(auth: auth);
    switch (method) {
      case 'GET':
        res = await http.get(uri, headers: headers);
      case 'POST':
        res = await http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body));
      case 'PUT':
        res = await http.put(uri, headers: headers, body: body == null ? null : jsonEncode(body));
      default:
        throw ApiException('طريقة غير مدعومة');
    }

    Map<String, dynamic> data = {};
    if (res.body.isNotEmpty) {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) data = decoded;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(data['message'] as String? ?? 'فشل الطلب (${res.statusCode})');
    }
    return parse(data);
  }

  Future<AetherionUser> meRequest() async {
    final data = await _request(
      'GET',
      '/api/auth/me',
      parse: (json) => AetherionUser.fromJson(json['user'] as Map<String, dynamic>),
    );
    return data;
  }

  Future<void> register(String username, String password, {String? displayName}) async {
    final data = await _request(
      'POST',
      '/api/auth/register',
      auth: false,
      body: {
        'username': username,
        'password': password,
        if (displayName != null && displayName.isNotEmpty) 'displayName': displayName,
      },
      parse: (json) => json,
    );
    await _persistToken(data['token'] as String);
    user = AetherionUser.fromJson(data['user'] as Map<String, dynamic>);
    await refreshAccountData();
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final data = await _request(
      'POST',
      '/api/auth/login',
      auth: false,
      body: {'username': username, 'password': password},
      parse: (json) => json,
    );
    await _persistToken(data['token'] as String);
    user = AetherionUser.fromJson(data['user'] as Map<String, dynamic>);
    await refreshAccountData();
    notifyListeners();
  }

  Future<void> logout() async {
    await clearSession();
    notifyListeners();
  }

  Future<void> clearSession() async {
    await _persistToken(null);
    user = null;
    progress = null;
    decks = [];
  }

  Future<void> refreshAccountData() async {
    if (_token == null) return;
    final results = await Future.wait([
      _request('GET', '/api/progress', parse: (json) => PlayerProgress.fromJson(json)),
      _request(
        'GET',
        '/api/decks',
        parse: (json) => (json['decks'] as List<dynamic>)
            .map((e) => SavedDeck.fromJson(e as Map<String, dynamic>))
            .toList(),
      ),
    ]);
    progress = results[0] as PlayerProgress;
    decks = results[1] as List<SavedDeck>;
    notifyListeners();
  }

  Future<SavedDeck> saveDeck({
    required String name,
    required List<String> cardIds,
    bool? isActive,
    int? id,
  }) async {
    final path = id != null ? '/api/decks/$id' : '/api/decks';
    final method = id != null ? 'PUT' : 'POST';
    final body = <String, dynamic>{
      'name': name,
      'cardIds': cardIds,
      'isActive': ?isActive,
    };

    final deck = await _request(
      method,
      path,
      body: body,
      parse: (json) => SavedDeck.fromJson(json['deck'] as Map<String, dynamic>),
    );
    await refreshAccountData();
    return deck;
  }

  Future<SavedDeck> activateDeck(int id) async {
    final deck = await _request(
      'POST',
      '/api/decks/$id/activate',
      parse: (json) => SavedDeck.fromJson(json['deck'] as Map<String, dynamic>),
    );
    await refreshAccountData();
    return deck;
  }
}

final apiService = ApiService();
