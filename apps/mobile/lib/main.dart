import 'package:flutter/material.dart';

import 'api_service.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await apiService.init();
  runApp(const AetherionApp());
}

class AetherionApp extends StatelessWidget {
  const AetherionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: MaterialApp(
        title: 'أثيريون',
        debugShowCheckedModeBanner: false,
        theme: buildAetherionTheme(),
        locale: const Locale('ar'),
        home: const HomeScreen(),
      ),
    );
  }
}
