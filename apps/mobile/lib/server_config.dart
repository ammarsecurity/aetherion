import 'dart:io';

import 'package:flutter/foundation.dart';

/// Override before connecting to point at a custom host (e.g. `localhost`).
String aetherionServerHost = _defaultServerHost();

String _defaultServerHost() {
  if (kIsWeb) return 'localhost';
  if (Platform.isAndroid) return '10.0.2.2';
  return 'localhost';
}

int aetherionServerPort = 8787;

String get aetherionServerUrl => 'http://$aetherionServerHost:$aetherionServerPort';
