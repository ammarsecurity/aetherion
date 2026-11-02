import 'package:aetherion/screens/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Home shows brand title', (WidgetTester tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.rtl,
        child: MaterialApp(home: HomeScreen(autoConnect: false)),
      ),
    );
    expect(find.text('أثيريون'), findsWidgets);
  });
}
